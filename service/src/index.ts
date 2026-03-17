// Gateway service exports
export { routeMessage, disconnectService } from './common/router.js';
export { VSCodeWebViewLike } from './hook/adapter.js';
export { setVscodeWorkspace, setRunningCWD, setDefaultLang } from './hook/setting.js';
export { clientMap } from './mcp/connect.service.js';

// SDK exports
export { TaskLoopAdapter, OmAgent, UserMessage, AssistantMessage, OmdbStore } from './hook/sdk.js';
export type { 
    OmAgentConfiguration
} from './hook/sdk.js';
