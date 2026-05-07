# 使用说明

## 前置条件

### Gateway

除 `gateway run|start|stop|restart|status` 以及仅本地打印帮助外，**`mcp`、`llm` 等多数命令**都需要 Gateway 进程在运行，且 WebSocket 地址可达（默认 **`ws://localhost:8282`**）。

若 Gateway 监听其它端口，请在各命令上加：

```text
-g ws://127.0.0.1:<端口>
```

### Service 能力

CLI 不单独实现业务逻辑，请求由 **Gateway** 转发到 **OpenMCP Service**（与 VSCode 扩展使用的同一套 `routeMessage`）。因此：

- 需保证 Gateway 使用的 `service` 版本与预期一致（通常与 monorepo 一起构建）。
- 需先 **建立 MCP 连接** 得到 `clientId`，再调用 `tools/list`、`tools/call` 等依赖连接的命令。
- CLI 会自动记录默认会话，后续 `mcp` 子命令可不显式传 `--client-id`。

## 典型流程

### 1. 启动 Gateway

```bash
openmcp gateway start
# 或前台看日志
openmcp gateway run -p 8282
```

### 2. 建立连接并拿到 clientId（支持扁平配置与 mcpServers）

`mcp connect` 的 `--config-file` 支持两种格式：

- 扁平 `McpOptions`（`connectionType`、`command`、`args`、`url`...）
- 聚合 `mcpServers`（Cursor / VSCode 常见格式，必要时加 `--mcp-server <name>`）

完整示例见：

```bash
openmcp mcp connect --help
```

**方式 A：配置文件**

```bash
openmcp mcp connect --config-file ./my-mcp.json
openmcp mcp connect --config-file ./mcp-servers.json --mcp-server my-server
```

**方式 B：命令行参数**

```bash
openmcp mcp connect --type STDIO --command npx --args-json "[\"-y\",\"@modelcontextprotocol/server-everything\"]"
```

成功时响应里的 `msg.clientId` 会被记录为默认会话。

如果希望把连接、测试用例、验证套件都落到统一的本地仓储，推荐先把连接保存成资源，再通过资源建立会话：

```bash
openmcp connection save -f ./my-mcp.json --name my-local
openmcp connection list
openmcp connection connect --id <connectionId>
```

### 3. 会话管理（可选）

```bash
openmcp mcp sessions current
openmcp mcp sessions recent --limit 10
openmcp mcp sessions list
openmcp mcp sessions use --client-id "<uuid>"
```

### 4. 调用 tools/prompts/resources

```bash
openmcp mcp tools-list
openmcp mcp tools-call --name echo --args "{\"message\":\"hi\"}"
openmcp validation tool --tool-name echo
```

如果要显式指定目标连接，可加 `--client-id <uuid>`。

### 4.1 本地测试用例与验证套件

```bash
# 本地 user scope
openmcp test-case list --connection-id <connectionId>
openmcp test-case save --connection-id <connectionId> -f ./tool-case.json
openmcp validation-suite list --connection-id <connectionId>
openmcp validation-suite save --connection-id <connectionId> -f ./suite.json

# 工作区 scope
openmcp connection list --scope workspace --workspace .
openmcp test-case list --scope workspace --workspace . --connection-id <connectionId>

```

`test-case` 与 `validation-suite` 默认都是 `user` scope；切到 `workspace` 时需要显式传 `--scope`。

### 5. 配置生命周期与调试留痕

```bash
# 配置校验 / 模板 / 导出 / env 预览
openmcp mcp config validate -f ./mcp.json
openmcp mcp config init --template stdio -o ./mcp-template.json
openmcp mcp config export --client-id "<uuid>" -o ./exported.json
openmcp mcp config env-preview -f ./mcp.json

# 历史与回放
openmcp mcp history list --limit 20
openmcp mcp history replay --failed --limit 1
```

## Web UI 与一键启动

- **`openmcp webui`**：可选启动 Gateway，并启动 Renderer（网站模式），浏览器打开本地 Web UI。
- **`openmcp start`**：同时启动 Gateway 与 Web UI。

具体端口与选项见 `openmcp webui --help`、`openmcp start --help`。

## 大 JSON 与超时

- 对请求体较大的场景，优先使用各子命令提供的 `-f` 读文件能力（如 `llm chat-sync`、`validation batch`）。
- `mcp connect` 默认超时较长；其它子命令如需更细粒度控制，建议拆分调用并结合历史回放定位问题。

## 流式 LLM

`llm/chat/completions` 为**流式**接口，面向 Webview 的多条推送；CLI 日常请使用：

- `openmcp llm chat-sync`（对应 `llm/chat/completions/sync`），或  
- `openmcp llm chat-sync -f body.json`
