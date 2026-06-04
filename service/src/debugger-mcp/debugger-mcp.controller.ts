import { Controller } from '../common/index.js';
import { RequestData } from '../common/index.dto.js';
import { PostMessageble } from '../hook/adapter.js';
import { loadDebuggerMcpConfig, saveDebuggerMcpConfig } from './debugger-mcp-storage.service.js';
import {
    ensureDebuggerMcpServer,
    getDebuggerMcpConnectionInfo,
    runSimpleAgent,
    stopDebuggerMcpServer
} from './debugger-mcp.service.js';
import type { DebuggerMcpConfig } from './debugger-mcp.dto.js';

const ALL_TOOL_NAMES = [
    'openmcp_debugger_list_all_tools',
    'openmcp_debugger_execute_tool',
    'openmcp_debugger_list_batch_test_samples',
    'openmcp_debugger_execute_batch_test_sample'
];

export class DebuggerMcpController {
    @Controller('debug-chat/run-agent')
    async runAgent(data: RequestData, _webview: PostMessageble) {
        const { clientId, input, llmConfig } = data as any;
        if (!clientId || typeof clientId !== 'string') {
            return { code: 400, msg: 'clientId is required' };
        }
        if (!input || typeof input !== 'string') {
            return { code: 400, msg: 'input is required' };
        }
        if (!llmConfig?.baseURL || !llmConfig?.apiKey || !llmConfig?.model) {
            return { code: 400, msg: 'llmConfig must include baseURL, apiKey, and model' };
        }
        try {
            const trace = await runSimpleAgent(clientId, input, {
                baseURL: String(llmConfig.baseURL),
                apiKey: String(llmConfig.apiKey),
                model: String(llmConfig.model),
                useAnthropicProtocol: !!llmConfig.useAnthropicProtocol
            });
            return { code: 200, msg: { trace } };
        } catch (error) {
            return { code: 500, msg: error instanceof Error ? error.message : String(error) };
        }
    }

    @Controller('debugger-mcp/load')
    async loadConfig(_data: RequestData, _webview: PostMessageble) {
        const config = loadDebuggerMcpConfig();
        const tools = ALL_TOOL_NAMES.map(name => ({
            name,
            enabled: config.enabledTools[name] !== false
        }));
        return {
            code: 200,
            msg: {
                enabled: config.enabled,
                port: config.port,
                tools
            }
        };
    }

    @Controller('debugger-mcp/save')
    async saveConfig(data: RequestData, _webview: PostMessageble) {
        const { enabled, port, enabledTools } = data as any;
        const prevConfig = loadDebuggerMcpConfig();
        const config: Partial<DebuggerMcpConfig> = {};
        if (typeof enabled === 'boolean') config.enabled = enabled;
        if (typeof port === 'number') config.port = port;
        if (enabledTools && typeof enabledTools === 'object') {
            config.enabledTools = enabledTools;
        }
        saveDebuggerMcpConfig(config);
        const fullConfig = loadDebuggerMcpConfig();
        if (fullConfig.enabled && !prevConfig.enabled) {
            console.log('[debugger-mcp] 用户已开启 OpenMCP Debugger MCP，开始启动服务...');
        }
        const result = await ensureDebuggerMcpServer(fullConfig);
        return {
            code: 200,
            msg: {
                saved: true,
                running: !!result,
                port: result?.port ?? fullConfig.port,
                url: result?.url ?? null
            }
        };
    }

    @Controller('debugger-mcp/connection-info')
    async getConnectionInfo(_data: RequestData, _webview: PostMessageble) {
        const info = getDebuggerMcpConnectionInfo();
        if (!info) {
            return {
                code: 200,
                msg: { running: false, connectionJson: null, port: null, url: null }
            };
        }
        return {
            code: 200,
            msg: {
                running: true,
                port: info.port,
                url: info.url,
                connectionJson: info.connectionJson
            }
        };
    }

    @Controller('debugger-mcp/toggle-tool')
    async toggleTool(data: RequestData, _webview: PostMessageble) {
        const { toolName, enabled } = data as { toolName: string; enabled: boolean };
        if (!toolName || typeof enabled !== 'boolean') {
            return { code: 400, msg: 'toolName and enabled required' };
        }
        const config = loadDebuggerMcpConfig();
        config.enabledTools = { ...config.enabledTools, [toolName]: enabled };
        saveDebuggerMcpConfig({ enabledTools: config.enabledTools });
        const result = await ensureDebuggerMcpServer(config);
        return {
            code: 200,
            msg: {
                toolName,
                enabled,
                restarted: !!result
            }
        };
    }
}
