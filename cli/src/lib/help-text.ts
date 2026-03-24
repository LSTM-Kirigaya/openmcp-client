/**
 * Commander addHelpText('after', ...) 用的说明与示例（中文）。
 */

export const HELP_GATEWAY = `
提示: 默认 WebSocket 为 ws://localhost:8282；若 gateway 使用其它端口（如 -p 9000），请在使用 mcp/cloud 等命令时加 -g ws://127.0.0.1:9000。
`;

export const HELP_PROGRAM_AFTER = `
常用示例:
  openmcp-cli gateway start
  openmcp-cli mcp connect --help
  openmcp-cli mcp connect --config-file ./mcp-options.json

说明: 多数子命令需 Gateway 已启动（默认 ws://localhost:8282），详见各命令 --help。
`;

export const HELP_MCP_ROOT = `
子命令概览:
  connect              建立 MCP 连接（需 --config-file 或 --type 等）
  disconnect / ping    断开或探测连接
  lookup-env           解析环境变量
  server-version       服务端版本
  prompts-* / resources-* / tools-*  需先有 clientId（connect 成功返回）

获取 clientId: 先执行 connect，响应 JSON 中 msg.clientId 即为后续 --client-id。
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
  openmcp-cli cloud auth login -u myuser -p mypass
  openmcp-cli cloud auth oauth github
  openmcp-cli cloud auth oauth github --redirect-uri http://localhost:3000/callback
  openmcp-cli cloud auth oauth github --open
`;

export const HELP_LLM = `
示例:
  openmcp-cli llm models --base-url https://api.openai.com/v1 --api-key sk-...
  openmcp-cli llm models-openrouter
  openmcp-cli llm chat-sync -f ./chat-body.json
  openmcp-cli llm abort --session-id <id>

chat-sync 的 JSON 需含: baseURL, apiKey, model, messages（OpenAI 格式数组）, 可选 temperature。
`;

export const HELP_SETTING = `
示例:
  openmcp-cli setting load
  openmcp-cli setting save -f ./settings.json
  openmcp-cli setting set-tour --user-has-read-guide true
  openmcp-cli setting get-tour
`;

export const HELP_PANEL = `
多数子命令需 -c / --client-id；大块数据用 -f JSON 文件（结构与 Web 面板导出一致）。

示例:
  openmcp-cli panel load -c <clientId>
  openmcp-cli panel variables-load -c <clientId>
  openmcp-cli panel variables-save -c <clientId> -f ./variables.json
`;

export const HELP_SKILLS = `
示例:
  openmcp-cli skills list
  openmcp-cli skills load --skill-name myskill
  openmcp-cli skills read-file --skill-name myskill --file-path README.md
`;

export const HELP_FEEDBACK = `
示例:
  openmcp-cli feedback save --name mystore -f ./storage.json
  openmcp-cli feedback count --name mystore
  openmcp-cli feedback list-data --name mystore --page 1 --page-size 20
`;

export const HELP_BATCH_VALIDATION = `
示例:
  openmcp-cli batch-validation run -f ./batch-body.json

body 需含 messages、testCases、llmConfig（baseURL, apiKey, model）等，见 service BatchValidationController。
`;

export const HELP_DEBUGGER = `
示例:
  openmcp-cli debugger-mcp load
  openmcp-cli debugger-mcp save -f ./debugger-mcp.json
  openmcp-cli debugger-mcp connection-info
  openmcp-cli debugger-mcp toggle-tool --tool-name openmcp_debugger_list_all_tools --enabled true
`;

export const HELP_OCR = `
示例:
  openmcp-cli ocr get-image --filename <disk-name>
  openmcp-cli ocr start -f ./image-payload.json
  openmcp-cli ocr start --image-file ./shot.png --mime-type image/png
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
  openmcp-cli mcp <子命令> --client-id <从 connect 得到的 UUID> [-g ws://127.0.0.1:8282]
`;
