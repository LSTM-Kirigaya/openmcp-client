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

## `connection`

本地连接资源管理。默认作用于 `user` scope；若要操作工作区连接，显式传 `--scope workspace --workspace <path>`。

| 子命令 | 说明 |
|--------|------|
| `list` | 列出本地连接 |
| `get` | 获取单个连接 |
| `save` | 保存/更新连接（支持对象、数组、`mcpServers` 聚合配置） |
| `delete` | 删除连接 |
| `connect` | 使用已保存连接直接建立会话 |

---

## `test-case`

统一的测试用例资源入口。

| 子命令 | 说明 |
|--------|------|
| `list/get/save/delete` | 本地 `user/workspace` 或云端 `cloud` 统一 CRUD |

说明：

- 本地 scope 推荐用 `--connection-id` 指定所属连接；若当前已有默认会话，也可用 `--client-id`
- `--scope cloud` 时需传 `--project-id`，底层映射到 `spec-cases` 中的 `tool_case`

---

## `validation-suite`

统一的批量验证套件入口。

| 子命令 | 说明 |
|--------|------|
| `list/get/save/delete` | 本地 `user/workspace` 或云端 `cloud` 统一 CRUD |

说明：

- 本地 scope 会读写统一的 `validation-suites` 目录
- `--scope cloud` 时需传 `--project-id`，底层映射到 `batch-validation-cases`

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
| `list` | 查看当前全部设置（等价于 `load`） |
| `set` | `--key` + (`--value` 或 `--json`) 单项修改顶层设置 |
| `save` | `-f` / `-d` 整包保存 |

`set` 会先读取当前 settings，再只覆盖指定键后保存，避免手工准备整包 JSON。`--value` 默认优先按 JSON 字面量解析（例如 `120`、`true`、`null`），解析失败时按普通字符串处理；对象/数组或想显式写入字符串时可用 `--json`。

---

## `skills`

`list`、`load`、`read-file`（参数与 `SkillController` 一致）。

---

## `validation`

| 子命令 | 说明 |
|--------|------|
| `tool` | 执行已保存的工具测试用例，并与 `expectedOutput` 对比 |
| `batch` | `-f` / `-d`，执行批量验证 |

`tool` 默认读取当前会话对应服务下保存的 `test-cases`，逐个调用工具并回写 `status` / `actualOutput`。可用 `--tool-name`、`--case-id`、`--case-name` 过滤；不传 `--client-id` 时，默认使用当前会话。

---

## Service 命令名速查

源码维护列表：`cli/src/lib/service-commands.ts`。新增后端 `@Controller` 时请同步更新该文件与本文档相关段落。
