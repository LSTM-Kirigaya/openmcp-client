/**
 * Commander addHelpText('after', ...) 用的说明与示例（中文）。
 */

export const HELP_GATEWAY = `
提示: 默认 WebSocket 为 ws://localhost:8282；若 gateway 使用其它端口（如 -p 9000），请在使用 mcp/cloud 等命令时加 -g ws://127.0.0.1:9000。

文件日志目录（与 gateway.env 同属用户目录 .openmcp）: 运行 gateway logs-dir 查看绝对路径；gateway logs 查看 gateway.log 尾部。

云端 API 基址由 Gateway 进程内 @openmcp/service 决定，与运行 CLI 的终端无关。默认规则：
  · 未设 OPENMCP_API_BASE_URL 时：NODE_ENV=production（如 tsc 构建后的产物）→ 远程；否则 → 本地 http://localhost:8000
  · OPENMCP_APP_ENV=development|production 可覆盖上述逻辑（见 service/.env.example）
  · OPENMCP_API_BASE_URL 始终优先（可指向任意后端）
  · service 包根目录的 .env 会在首次请求前自动加载（不覆盖已在环境中的变量）
  · 后台 Gateway 还可读 %USERPROFILE%\\.openmcp\\gateway.env（KEY=VALUE，终端已有环境变量优先）
`;

export const HELP_PROGRAM_AFTER = `
常用示例:
  openmcp-cli gateway start
  openmcp-cli mcp connect --help
  openmcp-cli mcp connect --config-file ./mcp-options.json
  openmcp-cli validation tool

说明: 多数子命令需 Gateway 已启动（默认 ws://localhost:8282），详见各命令 --help。
`;

export const HELP_MCP_ROOT = `
子命令概览:
  connect              建立 MCP 连接（需 --config-file 或 --type 等）
  sessions-*           会话管理（list/current/recent/use）
  config-*             配置生命周期（validate/init/export/env-preview）
  history-*            调用历史查询与回放
  disconnect / ping    断开或探测连接
  lookup-env           解析环境变量
  server-version       服务端版本
  prompts-* / resources-* / tools-*  默认使用当前会话，亦可 --client-id 指定

获取 clientId: 先执行 connect，响应 JSON 中 msg.clientId；CLI 会自动记为当前默认会话。
`;

export const HELP_MCP_CONNECT = `
--config-file <path> 文件要求:
  · UTF-8 编码 JSON，支持两种格式：
    1) 扁平 McpOptions（connectionType/command/args/url/cwd/env 等字段）
    2) 外层含 mcpServers 的聚合配置（Cursor / VSCode 常见格式）
  · 若是第 2 种且含多个 server，请额外传 --mcp-server <name>

STDIO 示例 mcp-stdio.json:
  {
    "connectionType": "STDIO",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-everything"],
    "cwd": "C:/path/to/workdir"
  }

SSE 示例 mcp-sse.json:
  {
    "connectionType": "SSE",
    "url": "http://127.0.0.1:3000/sse"
  }

Streamable HTTP 示例:
  {
    "connectionType": "STREAMABLE_HTTP",
    "url": "http://127.0.0.1:8080/mcp"
  }

mcpServers 聚合示例 mcp-servers.json:
  {
    "version": "1.0.0",
    "mcpServers": {
      "my-browser": {
        "command": "npx",
        "args": ["tsx", "./add-server.mts"]
      },
      "remote-http": {
        "type": "http",
        "url": "http://127.0.0.1:8080/mcp"
      }
    }
  }

命令行等价（无配置文件时，--args-json 建议整体用单引号包住 JSON）:
  openmcp-cli mcp connect --type STDIO --command npx --args-json '["-y","@modelcontextprotocol/server-everything"]' --cwd .
  openmcp-cli mcp connect --type SSE --url http://127.0.0.1:3000/sse
  openmcp-cli mcp connect --config-file ./mcp-servers.json --mcp-server my-browser
`;

export const HELP_CLOUD = `
示例:
  openmcp-cli cloud auth register --email me@example.com -u myuser -p mypass
  openmcp-cli cloud auth login -u myuser -p mypass
  openmcp-cli cloud auth refresh
  openmcp-cli cloud projects create --name "demo-project"
  openmcp-cli cloud projects members list --project-id <projectId>
  openmcp-cli cloud projects invites create --project-id <projectId> --role writer
  openmcp-cli cloud spec-cases tree --project-id <projectId>
  openmcp-cli cloud spec-cases create --project-id <projectId> --node-type case --type tool_case --tool-name weather.get_current --name "天气用例"
  openmcp-cli cloud batch-validation-cases list --project-id <projectId>
  openmcp-cli cloud auth oauth github
  openmcp-cli cloud auth oauth github --redirect-uri http://localhost:3000/callback
  openmcp-cli cloud auth oauth github --open
  openmcp-cli cloud auth oauth github --open --auto-store
  openmcp-cli cloud auth device github
`;

export const HELP_LLM = `
示例:
  openmcp-cli llm models --base-url https://api.openai.com/v1 --api-key sk-...
  openmcp-cli llm models-openrouter
  openmcp-cli llm chat-sync -f ./chat-body.json

chat-sync 的 JSON 需含: baseURL, apiKey, model, messages（OpenAI 格式数组）, 可选 temperature。
`;

export const HELP_SETTING = `
示例:
  openmcp-cli setting load
  openmcp-cli setting list
  openmcp-cli setting set --key MCP_TIMEOUT_SEC --value 120
  openmcp-cli setting set --key PROXY_SERVER --value http://127.0.0.1:7890
  openmcp-cli setting set --key LLM_INFO --json '[{"id":"custom-provider"}]'
  openmcp-cli setting save -f ./settings.json

说明:
  · load / list: 查看当前完整 settings
  · save: 整包保存 settings
  · set: 只修改一个顶层字段；--value 会优先按 JSON 字面量解析，失败则按字符串处理
`;

export const HELP_SKILLS = `
示例:
  openmcp-cli skills list
  openmcp-cli skills load --skill-name myskill
  openmcp-cli skills read-file --skill-name myskill --file-path README.md
`;

export const HELP_VALIDATION = `
示例:
  openmcp-cli validation tool
  openmcp-cli validation tool --tool-name weather.get_current
  openmcp-cli validation tool --case-id case_1
  openmcp-cli validation batch -f ./batch-body.json

说明:
  · validation tool：执行已保存的工具测试用例，自动读取输入并对比 expectedOutput
  · validation batch：执行批量验证，请求体需含 messages、testCases、llmConfig 等
`;

export const HELP_VALIDATION_TOOL = `
示例:
  openmcp-cli validation tool
  openmcp-cli validation tool --tool-name weather.get_current
  openmcp-cli validation tool --case-name "搜索天气_成功"

说明:
  · 不传 --client-id 时，默认使用 mcp connect / mcp sessions use 记录的当前会话
  · tool 会加载当前会话对应服务下保存的 test cases，并将执行结果回写到测试用例存储
  · 用例未配置 expectedOutput 时，只要工具调用成功就视为通过
`;

export const HELP_WEB = `
说明:
  - 默认是生产模式（静态托管 renderer/dist）
  - 设置环境变量 OPENMCP_WEB_DEV=1 后，切换到开发模式（Vite）
  - 不会启动/停止 Gateway；只在启动 Web UI 前做 WebSocket 握手检查 Gateway 是否可达
  - 支持子命令:
      run     前台运行（阻塞，Ctrl+C 退出）
      start   后台运行（立即返回）
      status  检查 Gateway 可达性 + Renderer 状态
      stop    停止后台运行的 Web UI（只停 Renderer）


示例:
  openmcp-cli webui run -p 8283 -g 8282
  openmcp-cli webui start -p 8283 -g 8282
  OPENMCP_WEB_DEV=1 openmcp-cli webui run -p 8283 -g 8282
  openmcp-cli webui status
  openmcp-cli webui stop
`;

export const HELP_START = `
说明: 同时启动 Gateway 与 Web UI，并可打开浏览器。

示例:
  openmcp-cli start --gateway-port 8282 --port 8283
`;

/** 子命令无单独示例时用一行说明 */
export const HELP_GENERIC_CLIENT = `
示例:
  openmcp-cli mcp <子命令> [--client-id <UUID>] [-g ws://127.0.0.1:8282]
  # 不传 --client-id 时，默认使用 mcp sessions use / connect 记录的当前会话
`;
