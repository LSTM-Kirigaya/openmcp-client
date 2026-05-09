/**
 * OpenMCP SDK
 *
 * An embeddable MCP client for Node.js applications.
 *
 * @example
 * import { OmAgent, UserMessage } from 'openmcp-sdk';
 *
 * const agent = new OmAgent();
 * agent.loadMcpConfig('./mcp-config.json');
 *
 * const result = await agent.ainvoke({
 *   messages: [UserMessage('Hello, help me with...')]
 * });
 */

// Re-export from sdk's own implementation
export { TaskLoopAdapter, OmAgent, UserMessage, AssistantMessage, OmdbStore, MessageState } from './hook/sdk.js';

// Re-export types
export type { MessageStateType } from './hook/sdk.js';
export type {
    OmAgentConfiguration,
    AinvokeConfig,
    DefaultLLM,
    LoadMcpConfigParam,
    TaskLoopOptions,
    ChatMessage,
    TextMessage,
    ToolCall,
    ToolCallResult,
    ChatSetting,
    IConnectionArgs,
    MessageHandler,
    WebSocketMessage,
    ConnectionType,
} from './hook/sdk.js';
