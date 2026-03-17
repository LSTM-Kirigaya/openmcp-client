// Gateway service exports
export { routeMessage, disconnectService } from './common/router.js';
export { VSCodeWebViewLike } from './hook/adapter.js';
export type { IConnectionArgs, MessageHandler, WebSocketMessage } from './hook/adapter.js';
export { setVscodeWorkspace, setRunningCWD, setDefaultLang, setForbiddenMonitor, setRefluxHome, FORBIDDEN_MONITOR } from './hook/setting.js';
export { clientMap } from './mcp/connect.service.js';
export type { ConnectionType } from './mcp/client.dto.js';

// Re-export common utilities
export { OmdbStore } from './common/omdb-store.js';
export { loadSetting, saveSetting } from './setting/setting.service.js';

// TaskLoop class is available at runtime via:
//   const { TaskLoop } = await import('@openmcp/service/dist/task-loop.js');
