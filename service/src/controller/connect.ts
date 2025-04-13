import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Implementation } from "@modelcontextprotocol/sdk/types";

// 定义连接类型
type ConnectionType = 'STDIO' | 'SSE';

type McpTransport = StdioClientTransport | SSEClientTransport;
export type IServerVersion = Implementation | undefined;

// 定义命令行参数接口
export interface MCPOptions {
    connectionType: ConnectionType;
    // STDIO 特定选项
    command?: string;
    args?: string[];
    // SSE 特定选项
    url?: string;
    cwd?: string;
    // 通用客户端选项
    clientName?: string;
    clientVersion?: string;
}

// 增强的客户端类
export class MCPClient {
    private client: Client;
    private transport?: McpTransport;
    private options: MCPOptions;
    private serverVersion: IServerVersion;

    constructor(options: MCPOptions) {
        this.options = options;
        this.serverVersion = undefined;

        this.client = new Client(
            {
                name: "openmcp test local client",
                version: "0.0.1"
            },
            {
                capabilities: {
                    prompts: {},
                    resources: {},
                    tools: {}
                }
            }
        );
    }

    // 连接方法
    public async connect(): Promise<void> {
        // 根据连接类型创建传输层
        switch (this.options.connectionType) {
            case 'STDIO':
                this.transport = new StdioClientTransport({
                    command: this.options.command || '',
                    args: this.options.args || [],
                    cwd: this.options.cwd || process.cwd()
                });
                break;
            case 'SSE':
                if (!this.options.url) {
                    throw new Error('URL is required for SSE connection');
                }
                this.transport = new SSEClientTransport(new URL(this.options.url));
                break;
            default:
                throw new Error(`Unsupported connection type: ${this.options.connectionType}`);
        }

        // 建立连接
        await this.client.connect(this.transport);
        console.log(`Connected to MCP server via ${this.options.connectionType}`);        
    }

    public getServerVersion() {
        if (this.serverVersion) {
            return this.serverVersion;
        }

        const version = this.client.getServerVersion();
        this.serverVersion = version;
        return version;
    }

    // 断开连接
    public async disconnect(): Promise<void> {
        await this.client.close();
        
        console.log('Disconnected from MCP server');
    }

    // 列出提示
    public async listPrompts() {
        return await this.client.listPrompts();
    }

    // 获取提示
    public async getPrompt(name: string, args: Record<string, any> = {}) {        
        return await this.client.getPrompt({
            name, arguments: args
        });
    }

    // 列出资源
    public async listResources() {
        return await this.client.listResources();
    }

    // 列出所有模板资源
    public async listResourceTemplates() {
        return await this.client.listResourceTemplates();
    }

    // 读取资源
    public async readResource(uri: string) {
        return await this.client.readResource({
            uri
        });
    }

    // 列出所有工具
    public async listTools() {
        return await this.client.listTools();
    }

    // 调用工具
    public async callTool(options: { name: string; arguments: Record<string, any> }) {
        return await this.client.callTool(options);
    }
}

// Connect 函数实现
export async function connect(options: MCPOptions): Promise<MCPClient> {
    const client = new MCPClient(options);
    await client.connect();
    return client;
}
