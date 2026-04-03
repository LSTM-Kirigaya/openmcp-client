/**
 * Commander addHelpText('after', ...) 用的说明与示例（中文）。
 */

export const HELP_GATEWAY = `
提示: 默认 WebSocket 为 ws://localhost:8282；若 gateway 使用其它端口（如 -p 9000），请在使用命令时加 -g ws://127.0.0.1:9000。

文件日志目录（与 gateway.env 同属用户目录 .openmcp）: 运行 gateway logs-dir 查看绝对路径；gateway logs 查看 gateway.log 尾部。

云端 API 基址由 Gateway 进程内 @openmcp/service 决定，与运行 CLI 的终端无关。默认规则：
  · 未设 OPENMCP_API_BASE_URL 时：NODE_ENV=production（如 tsc 构建后的产物）→ 远程；否则 → 本地 http://localhost:8000
  · OPENMCP_APP_ENV=development|production 可覆盖上述逻辑（见 service/.env.example）
  · OPENMCP_API_BASE_URL 始终优先（可指向任意后端）
  · service 包根目录的 .env 会在首次请求前自动加载（不覆盖已在环境中的变量）
  · 后台 Gateway 还可读 %USERPROFILE%\\.openmcp\\config\\gateway.env（KEY=VALUE，终端已有环境变量优先）
`;

export const HELP_PROGRAM_AFTER = `
常用示例:
  openmcp-cli gateway start
  openmcp-cli setting llm provider list
  openmcp-cli setting general list
  openmcp-cli setting cloud login -u myuser -p mypass
  openmcp-cli mcp server list
  openmcp-cli mcp server add -f ./my-server.json
  openmcp-cli mcp session connect --id <SERVER_ID>
  openmcp-cli mcp session list
  openmcp-cli debug tool list
  openmcp-cli debug tool test-case list --connection-id <id>
  openmcp-cli debug tool run
  openmcp-cli debug batch run -f ./batch-body.json
  openmcp-cli debug mcp ping

说明: 多数子命令需 Gateway 已启动（默认 ws://localhost:8282），详见各命令 --help。
`;

export const HELP_WEB = `
说明:
  - 默认是生产模式（静态托管 renderer/dist）
  - 设置环境变量 OPENMCP_WEB_DEV=1 后，切换到开发模式（Vite）
  - 不会启动/停止 Gateway；只在启动 Web UI 前做 WebSocket 握手检查 Gateway 是否可达
  - 支持子命令:
      run     前台运行（阻塞，Ctrl+C 退出）
      start   后台运行（立即返回）
      restart 后台重启（先 stop 再 start，与 gateway restart 类似）
      status  检查 Gateway 可达性 + Renderer 状态
      stop    停止后台运行的 Web UI（只停 Renderer）


示例:
  openmcp-cli webui run -p 8283 -g 8282
  openmcp-cli webui start -p 8283 -g 8282
  openmcp-cli webui restart -p 8283 -g 8282
  OPENMCP_WEB_DEV=1 openmcp-cli webui run -p 8283 -g 8282
  openmcp-cli webui status
  openmcp-cli webui stop
`;

export const HELP_START = `
说明: 同时启动 Gateway 与 Web UI，并可打开浏览器。

示例:
  openmcp-cli start --gateway-port 8282 --port 8283
`;

export const HELP_SKILLS = `
示例:
  openmcp-cli skills list
  openmcp-cli skills load --skill-name myskill
  openmcp-cli skills read-file --skill-name myskill --file-path README.md
`;

export const HELP_GENERIC_CLIENT = `
示例:
  openmcp-cli debug mcp <子命令> [--client-id <UUID>] [-g ws://127.0.0.1:8282]
`;
