/** OpenMCP Debugger MCP 配置 */
export interface DebuggerMcpConfig {
    /** 是否开启 */
    enabled: boolean;
    /** 端口，默认 1145 */
    port: number;
    /** 各工具是否启用，key 为工具名 */
    enabledTools: Record<string, boolean>;
}

export const DEFAULT_DEBUGGER_MCP_CONFIG: DebuggerMcpConfig = {
    enabled: false,
    port: 1145,
    enabledTools: {}
};

/** MCP 工具定义，用于列出所有已连接 MCP 的工具 */
export interface McpToolItem {
    clientId: string;
    serverName: string;
    serverVersion: string;
    name: string;
    description?: string;
    inputSchema?: object;
}
