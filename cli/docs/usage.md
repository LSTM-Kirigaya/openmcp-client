# 使用说明

## 前置条件

### Gateway

除 `gateway run|start|stop|restart|status` 以及仅本地打印帮助外，**`rpc`、`mcp`、`llm`、`auth` 等多数命令**都需要 Gateway 进程在运行，且 WebSocket 地址可达（默认 **`ws://localhost:8282`**）。

若 Gateway 监听其它端口，请在各命令上加：

```text
-g ws://127.0.0.1:<端口>
```

### Service 能力

CLI 不单独实现业务逻辑，请求由 **Gateway** 转发到 **OpenMCP Service**（与 VSCode 扩展使用的同一套 `routeMessage`）。因此：

- 需保证 Gateway 使用的 `service` 版本与预期一致（通常与 monorepo 一起构建）。
- 需先 **建立 MCP 连接** 得到 `clientId`，再调用 `tools/list`、`tools/call` 等依赖连接的命令。

## 典型流程

### 1. 启动 Gateway

```bash
openmcp-cli gateway start
# 或前台看日志
openmcp-cli gateway run -p 8282
```

### 2. 建立连接并拿到 clientId

`--config` 指向的必须是 **扁平的 McpOptions JSON**（字段如 `connectionType`、`command`、`args`、`url`），与 `service/src/mcp/client.dto.ts` 一致；**不是** Cursor/VSCode 里带 `mcpServers` 外层包装的那份。完整示例见：

```bash
openmcp-cli mcp connect --help
```

**方式 A：使用 `mcp connect`**

```bash
# 使用 JSON 文件描述 McpOptions（与 service 中 connect 一致）
openmcp-cli mcp connect --config ./my-mcp.json
```

**方式 B：使用 `rpc connect`**

```bash
openmcp-cli rpc connect -f ./my-mcp.json
```

成功时响应里的 `msg.clientId` 即为后续请求所需的 `clientId`。

### 3. 调用工具或通用 RPC

```bash
openmcp-cli mcp tools-list --client-id "<uuid>"
# 或
openmcp-cli rpc tools/list -d "{\"clientId\":\"<uuid>\"}"
```

### 4. 列出全部可用 service 命令名

```bash
openmcp-cli rpc --list
```

便于对照 `service/src/**/*controller.ts` 中的 `@Controller('...')`。

## Web UI 与一键启动

- **`openmcp-cli web`**：可选启动 Gateway，并启动 Renderer（网站模式），浏览器打开本地 Web UI。
- **`openmcp-cli start`**：同时启动 Gateway 与 Web UI。

具体端口与选项见 `openmcp-cli web --help`、`openmcp-cli start --help`。

## 大 JSON 与超时

- 批量验证、同步聊天等请求体较大或耗时长时，优先使用 **`rpc` 的 `-f`** 从文件读 JSON。
- **`rpc`** 默认超时较长（见 `--timeout`）；子命令内部对连接、OCR、LLM 等也设置了合理超时，若仍不够可统一用 `rpc` 并调大 `-t`。

## 流式 LLM

`llm/chat/completions` 为**流式**接口，面向 Webview 的多条推送；CLI 日常请使用：

- `openmcp-cli llm chat-sync`（对应 `llm/chat/completions/sync`），或  
- `openmcp-cli rpc llm/chat/completions/sync -f body.json`
