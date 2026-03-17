/**
 * OpenMCP SDK
 * 
 * An embeddable MCP client for Node.js applications.
 * 
 * @example
 * import { OmAgent, UserMessage } from '@openmcp/sdk';
 * 
 * const agent = new OmAgent();
 * agent.loadMcpConfig('./mcp-config.json');
 * 
 * const result = await agent.ainvoke({
 *   messages: [UserMessage('Hello, help me with...')]
 * });
 */

// Re-export from service
export { TaskLoopAdapter, OmAgent, UserMessage, AssistantMessage, OmdbStore } from '@openmcp/service';

// Re-export types
export type { 
    OmAgentConfiguration
} from '@openmcp/service';
