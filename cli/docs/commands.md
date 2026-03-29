# 命令参考

下列为顶层命令；子命令与选项以 **`openmcp-cli <command> --help`** 为准（程序内描述最准确）。

## 全局

```bash
openmcp-cli --help
openmcp-cli -V
```

程序名在代码中为 `openmcp-cli`；`package.json` 的 `bin` 同时提供 **`openmcp`** 与 **`openmcp-cli`**。

---

## `gateway`

管理 Gateway 进程（WebSocket 服务）。

| 子命令 | 说明 |
|--------|------|
| `run` | 前台运行，阻塞，便于看日志 |
| `start` | 后台启动 |
| `stop` | 停止（依赖 PID 文件） |
| `restart` | 重启 |
| `status` | 是否运行、PID 等 |

常用：`openmcp-cli gateway start -p 8282`

---

## `webui`

启动 Web UI（Renderer），可选同时启动 Gateway。

常用选项：`-p` Web 端口、`-g` Gateway 端口、`--no-gateway` 使用已有 Gateway。

---

## `start`

同时启动 Gateway 与 Web UI，并可选打开浏览器。

---

## `cloud`

云能力入口（当前仅认证登录，对应 `AuthController`）。

| 子命令 | 说明 |
|--------|------|
| `auth login` | `-u` / `-p`，账号密码登录 |
| `auth oauth <channel>` | 获取 OAuth 授权链接（如 `github`，支持 `--open` 自动打开浏览器） |

默认 `-g ws://localhost:8282`。

---

## `mcp`

MCP 连接与协议封装（Connect + Client 控制器）。

常见子命令：

| 子命令 | 说明 |
|--------|------|
| `connect` | 建立连接，支持 `--config-file`（扁平或 `mcpServers`） |
| `sessions list/current/recent/use` | 会话列表、默认会话切换、最近连接记录 |
| `config validate/init/export/env-preview` | 配置校验、模板、导出、环境注入预览 |
| `history list/replay` | 请求留痕查询与回放（支持失败重放） |
| `disconnect` / `ping` / `lookup-env` | 连接管理 |
| `prompts-*` / `resources-*` / `tools-*` | MCP 协议能力 |

`connect` 支持 `--config-file` 完整 JSON，或 `--type` + STDIO/SSE/STREAMABLE_HTTP 相关参数。依赖 `clientId` 的子命令可省略 `--client-id`，默认使用当前会话。

---

## `llm`

| 子命令 | 对应 service 命令 |
|--------|-------------------|
| `models` | `llm/models` |
| `models-openrouter` | `llm/models/openrouter` |
| `models-dynamic` | `llm/models/dynamic` |
| `chat-sync` | `llm/chat/completions/sync` |

`chat-sync` 支持 `-f` / `-d` 传入完整 body。

---

## `setting`

| 子命令 | 说明 |
|--------|------|
| `load` | 加载设置 |
| `save` | `-f` / `-d` 保存 |

---

## `skills`

`list`、`load`、`read-file`（参数与 `SkillController` 一致）。

---

## `batch-validation`

| 子命令 | 说明 |
|--------|------|
| `run` | `-f` / `-d`，执行批量验证 |

---

## Service 命令名速查

源码维护列表：`cli/src/lib/service-commands.ts`。新增后端 `@Controller` 时请同步更新该文件与本文档相关段落。
