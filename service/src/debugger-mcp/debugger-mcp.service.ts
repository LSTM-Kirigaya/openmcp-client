import type { Server as HttpServer } from 'node:http';
import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { clientMap, getClient } from '../mcp/connect.service.js';
import { loadSetting } from '../setting/setting.service.js';
import { runBatchValidation } from '../batch-validation/batch-validation.service.js';
import { getBatchValidationRepository } from '../panel/batch-validation.repository.js';
import { OpenAI } from 'openai';
import type { DebuggerMcpConfig } from './debugger-mcp.dto.js';
import { loadDebuggerMcpConfig, saveDebuggerMcpConfig } from './debugger-mcp-storage.service.js';

/** Tool call content item (MCP) */
interface ToolCallContentItem {
    type?: string;
    text?: string;
    [key: string]: unknown;
}

/** Batch validation test case */
interface BatchTestCase {
    id?: string;
    name?: string;
    input?: string;
    criteria?: string[];
}

let httpServer: HttpServer | null = null;
let currentPort: number | null = null;
let currentMcpServer: McpServer | null = null;
const transports: Record<string, StreamableHTTPServerTransport> = {};

const ALL_TOOL_NAMES = [
    'openmcp_debugger_list_all_tools',
    'openmcp_debugger_execute_tool',
    'openmcp_debugger_list_batch_test_samples',
    'openmcp_debugger_execute_batch_test_sample'
];

function getEnabledToolsSet(config: DebuggerMcpConfig): Set<string> {
    const set = new Set<string>();
    for (const name of ALL_TOOL_NAMES) {
        if (config.enabledTools[name] !== false) set.add(name);
    }
    return set;
}

function messagesToTrace(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
    return messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));
}

async function runSimpleAgent(
    clientId: string,
    userInput: string,
    llmConfig: { baseURL: string; apiKey: string; model: string }
): Promise<Array<{ role: string; content: string }>> {
    const client = getClient(clientId);
    if (!client) throw new Error(`MCP client ${clientId} not found`);
    const toolsRes = await client.listTools();
    const tools = (toolsRes?.tools || []).filter(t => t && t.name);
    const toolsSchema = tools.map(t => ({
        type: 'function' as const,
        function: {
            name: t.name,
            description: t.description || '',
            parameters: t.inputSchema || { type: 'object', properties: {} }
        }
    }));

    const openai = new OpenAI({ baseURL: llmConfig.baseURL, apiKey: llmConfig.apiKey });
    type MsgItem =
        | { role: 'user' | 'system'; content: string }
        | { role: 'assistant'; content: string; tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[] }
        | { role: 'tool'; content: string; tool_call_id: string };
    const messages: MsgItem[] = [
        { role: 'user', content: userInput }
    ];
    const maxIterations = 20;
    for (let i = 0; i < maxIterations; i++) {
        const response = await openai.chat.completions.create({
            model: llmConfig.model,
            messages: messages.map(m => {
                if (m.role === 'tool') {
                    return { role: m.role, content: m.content, tool_call_id: m.tool_call_id };
                }
                if (m.role === 'assistant' && 'tool_calls' in m && m.tool_calls) {
                    return { role: m.role, content: m.content, tool_calls: m.tool_calls };
                }
                return { role: m.role, content: m.content };
            }),
            tools: toolsSchema,
            tool_choice: 'auto',
            temperature: 0,
            stream: false
        });
        const message = response.choices?.[0]?.message;
        const toolCalls = message?.tool_calls;
        const assistantContent = typeof message?.content === 'string' ? message.content : (message?.content ?? '') || '';
        messages.push({
            role: 'assistant',
            content: assistantContent,
            ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
        });

        if (!toolCalls || toolCalls.length === 0) {
            break;
        }

        for (const tc of toolCalls) {
            const fn = tc.function ?? tc;
            const name = fn?.name ?? (tc as { name?: string }).name ?? '';
            const argsStr = fn?.arguments ?? (tc as { arguments?: string }).arguments ?? '{}';
            const toolCallId = (tc as { id?: string }).id ?? `call_${i}_${name}`;
            let args: Record<string, unknown> = {};
            try {
                args = typeof argsStr === 'string' ? (JSON.parse(argsStr) as Record<string, unknown>) : (argsStr as Record<string, unknown>);
            } catch { }
            const toolResult = await client.callTool({ name, arguments: args });
            const contentArray = Array.isArray(toolResult.content) ? toolResult.content : [];
            const content = contentArray
                .map((c: ToolCallContentItem) => (c.type === 'text' ? c.text : JSON.stringify(c)))
                .join('\n') || JSON.stringify(toolResult);
            messages.push({
                role: 'tool',
                content,
                tool_call_id: toolCallId
            });
        }
    }
    return messagesToTrace(messages);
}

async function createMcpServerInstance(config: DebuggerMcpConfig) {
    const enabledSet = getEnabledToolsSet(config);
    const TOOL_NAMES = {
        list_all_tools: 'openmcp_debugger_list_all_tools',
        execute_tool: 'openmcp_debugger_execute_tool',
        list_batch_test_samples: 'openmcp_debugger_list_batch_test_samples',
        execute_batch_test_sample: 'openmcp_debugger_execute_batch_test_sample'
    };

    const server = new McpServer({
        name: 'openmcp-debugger',
        version: '0.1.0',
        icons: [{ src: 'https://openmcp.kirigaya.cn/images/openmcp.png', mimeType: 'image/png' }]
    });

    if (enabledSet.has(TOOL_NAMES.list_all_tools)) {
        server.registerTool(TOOL_NAMES.list_all_tools, {
            title: 'List All Tools',
            description: 'List all tools from all connected MCP servers',
            inputSchema: z.object({}) as unknown as z.ZodRawShape
        }, async () => {
            const items: Array<{ clientId: string; serverName: string; serverVersion: string; name: string; description?: string }> = [];
            for (const [clientId, client] of clientMap) {
                if (!client) continue;
                try {
                    const version = client.getServerVersion();
                    const toolsRes = await client.listTools();
                    for (const t of toolsRes?.tools || []) {
                        if (t?.name) {
                            items.push({
                                clientId,
                                serverName: version?.name ?? 'unknown',
                                serverVersion: version?.version ?? '0',
                                name: t.name,
                                description: t.description
                            });
                        }
                    }
                } catch (e) {
                    console.error('[debugger-mcp] list tools error', clientId, e);
                }
            }
            return {
                content: [{ type: 'text' as const, text: JSON.stringify({ tools: items }, null, 2) }]
            };
        });
    }

    if (enabledSet.has(TOOL_NAMES.execute_tool)) {
        server.registerTool(TOOL_NAMES.execute_tool, {
            title: 'Execute Tool',
            description: 'Execute a tool from a connected MCP server. Provide clientId, toolName, and toolArgs (JSON object).',
            inputSchema: z.object({
                clientId: z.string().describe('The MCP client ID'),
                toolName: z.string().describe('Tool name to call'),
                toolArgs: z.record(z.unknown()).optional().describe('Tool arguments as JSON object')
            }) as unknown as z.ZodRawShape
        },
            async (args: Record<string, unknown>) => {
                const { clientId, toolName, toolArgs } = args as { clientId: string; toolName: string; toolArgs?: Record<string, unknown> };
                const client = getClient(clientId);
                if (!client) {
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Client ${clientId} not found` }), isError: true }]
                    };
                }
                try {
                    const res = await client.callTool({ name: toolName, arguments: toolArgs ?? {} });
                    const contentArr = Array.isArray(res.content) ? res.content : [];
                    const text = contentArr.map((c: ToolCallContentItem) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n') || JSON.stringify(res);
                    return {
                        content: [{ type: 'text' as const, text }],
                        isError: Boolean(res.isError)
                    };
                } catch (e) {
                    return {
                        content: [{ type: 'text' as const, text: String(e), isError: true }]
                    };
                }
            }
        );
    }

    if (enabledSet.has(TOOL_NAMES.list_batch_test_samples)) {
        server.registerTool(TOOL_NAMES.list_batch_test_samples, {
            title: 'List Batch Test Samples',
            description: 'List all batch validation test samples from all servers',
            inputSchema: z.object({}) as unknown as z.ZodRawShape
        }, async () => {
            const result: Array<{ serverName: string; testCases: Array<{ id: string; name?: string; input: string; criteria: string[] }> }> = [];
            const seenServers = new Set<string>();
            for (const [clientId, client] of clientMap) {
                if (!client) continue;
                const version = client.getServerVersion();
                const serverName = version?.name ?? 'default';
                if (seenServers.has(serverName)) continue;
                seenServers.add(serverName);
                try {
                    const repo = getBatchValidationRepository(serverName);
                    const storage = await repo.load();
                    const testCasesList = Array.isArray(storage?.testCases) ? storage.testCases : [];
                    const testCases = testCasesList.map((tc: BatchTestCase) => ({
                        id: tc.id ?? '',
                        name: tc.name,
                        input: tc.input ?? '',
                        criteria: tc.criteria ?? []
                    }));
                    result.push({ serverName, testCases });
                } catch (e) {
                    result.push({ serverName, testCases: [] });
                }
            }
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
            };
        });
    }

    if (enabledSet.has(TOOL_NAMES.execute_batch_test_sample)) {
        server.registerTool(TOOL_NAMES.execute_batch_test_sample, {
            title: 'Execute Batch Test Sample',
            description: 'Execute a batch validation test sample. Provide serverName and testCaseIndex (0-based).',
            inputSchema: z.object({
                serverName: z.string().describe('MCP server name'),
                testCaseIndex: z.number().int().min(0).describe('0-based index of the test case')
            }) as unknown as z.ZodRawShape
        },
            async (args: Record<string, unknown>) => {
                const { serverName, testCaseIndex } = args as { serverName: string; testCaseIndex: number };
                let clientId: string | null = null;
                for (const [cid, client] of clientMap) {
                    if (!client) continue;
                    if (client.getServerVersion()?.name === serverName) {
                        clientId = cid;
                        break;
                    }
                }
                if (!clientId) {
                    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `Server ${serverName} not found or not connected` }), isError: true }] };
                }
                const repo = getBatchValidationRepository(serverName);
                const storage = await repo.load();
                const tc = storage.testCases?.[testCaseIndex];
                if (!tc?.input?.trim() || !tc.criteria?.some((c: string) => c.trim())) {
                    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Invalid test case or empty input/criteria' }), isError: true }] };
                }
                const config = loadSetting();
                const llmInfo = config.LLM_INFO?.[config.MODEL_INDEX ?? 0] || config.LLM_INFO?.[0];
                if (!llmInfo?.baseUrl || !llmInfo?.userToken || !llmInfo?.userModel) {
                    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No LLM configured in settings' }), isError: true }] };
                }
                const llmConfig = {
                    baseURL: llmInfo.baseUrl || 'https://api.openai.com/v1',
                    apiKey: llmInfo.userToken || '',
                    model: llmInfo.userModel || llmInfo.models?.[0] || ''
                };
                try {
                    const trace = await runSimpleAgent(clientId, tc.input.trim(), llmConfig);
                    const testCasesForEval = (tc.criteria || []).filter((c: string) => c.trim()).map((c: string, i: number) => ({
                        id: `${tc.id}-c-${i}`,
                        expectedCriteria: c
                    }));
                    if (testCasesForEval.length === 0) {
                        return {
                            content: [{ type: 'text' as const, text: JSON.stringify({ trace, error: 'No criteria to evaluate' }) }]
                        };
                    }
                    const results = await runBatchValidation({
                        messages: trace,
                        testCases: testCasesForEval,
                        evaluationMode: storage.evaluationMode === 'score' ? 'score' : 'pass-fail',
                        llmConfig
                    });
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify({ trace, results }, null, 2) }]
                    };
                } catch (e) {
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify({ error: String(e) }), isError: true }]
                    };
                }
            }
        );
    }

    return server;
}

async function findAvailablePort(startPort: number): Promise<number> {
    const http = await import('node:http');
    return new Promise(resolve => {
        const tryPort = (p: number) => {
            const s = http.createServer();
            s.listen(p, '127.0.0.1', () => {
                s.close(() => resolve(p));
            });
            s.on('error', () => tryPort(p + 1));
        };
        tryPort(startPort);
    });
}

function logDebuggerMcp(...args: unknown[]) {
    console.log('[OpenMCP Debugger MCP]', ...args);
}

export async function startDebuggerMcpServer(config: DebuggerMcpConfig): Promise<{ port: number; url: string }> {
    logDebuggerMcp('启动中...');
    if (httpServer) {
        logDebuggerMcp('关闭已有实例');
        httpServer.close();
        httpServer = null;
        currentPort = null;
        Object.keys(transports).forEach(k => delete transports[k]);
    }
    const enabledSet = getEnabledToolsSet(config);
    if (enabledSet.size === 0) {
        logDebuggerMcp('错误: 至少需启用一个工具');
        throw new Error('At least one tool must be enabled');
    }
    logDebuggerMcp('查找可用端口，起始端口:', config.port);
    const port = await findAvailablePort(config.port);
    logDebuggerMcp('使用端口:', port, '已启用工具:', [...enabledSet].join(', '));
    const app = express();
    app.use(express.json({ limit: '5mb' }));

    // 参考 Lagrange.onebot transport.ts: 无状态模式，每次请求创建新 transport，复用同一 server，使用 JSON 响应
    currentMcpServer = await createMcpServerInstance(config);

    app.post('/mcp', async (req: Request, res: Response) => {
        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true
            });

            res.on('close', () => {
                transport.close();
            });

            console.log(currentMcpServer);

            await currentMcpServer?.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error('[debugger-mcp] Error handling MCP request:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error'
                    },
                    id: null
                });
            }
        }
    });

    // GET/DELETE: server → client (参考 Lagrange.onebot transport.ts)
    const handleSessionRequest = async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
    };

    app.get('/mcp', handleSessionRequest);
    app.get('/', (_req, res) => {
        res.send('OpenMCP Debugger MCP');
    });
    app.delete('/mcp', handleSessionRequest);

    await new Promise<void>((resolve, reject) => {
        const server = app.listen(port, '127.0.0.1', () => resolve()) as HttpServer;
        httpServer = server;
        server.on('error', reject);
    });
    currentPort = port;
    const url = `http://127.0.0.1:${port}/mcp`;
    logDebuggerMcp('Streamable HTTP 服务已启动:', url);
    return { port, url };
}

export function stopDebuggerMcpServer(): void {
    if (httpServer) {
        logDebuggerMcp('关闭服务');
        httpServer.close();
        httpServer = null;
        currentPort = null;
        Object.keys(transports).forEach(k => delete transports[k]);
    }
    currentMcpServer = null;
}

export function getDebuggerMcpConnectionInfo(): { port: number; url: string; connectionJson: string } | null {
    const config = loadDebuggerMcpConfig();
    if (!config.enabled || !httpServer) return null;
    const addr = httpServer?.address();
    const port = currentPort ?? (typeof addr === 'object' && addr !== null && 'port' in addr ? addr.port : config.port);
    const url = `http://127.0.0.1:${port}/mcp`;
    const connectionJson = JSON.stringify({
        mcpServers: {
            'openmcp-debugger': {
                url,
                headers: {}
            }
        }
    }, null, 2);
    return { port, url, connectionJson };
}

export async function ensureDebuggerMcpServer(config: DebuggerMcpConfig): Promise<{ port: number; url: string } | null> {
    if (!config.enabled) {
        logDebuggerMcp('配置已关闭，停止服务');
        stopDebuggerMcpServer();
        return null;
    }
    try {
        logDebuggerMcp('根据配置启动 MCP 服务器...');
        const result = await startDebuggerMcpServer(config);
        logDebuggerMcp('启动完成');
        return result;
    } catch (e) {
        logDebuggerMcp('启动失败:', e);
        return null;
    }
}
