import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Implementation } from "@modelcontextprotocol/sdk/types";

export interface GetPromptOption {
	promptId: string;
	args?: Record<string, any>;
}

export interface ReadResourceOption {
	resourceUri: string;
}

export interface CallToolOption {
	toolName: string;
	toolArgs: Record<string, any>;
}

// 定义连接类型
export type ConnectionType = 'STDIO' | 'SSE';  

export type McpTransport = StdioClientTransport | SSEClientTransport;
export type IServerVersion = Implementation | undefined;

// 定义命令行参数接口
export interface McpOptions {
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