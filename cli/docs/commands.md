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

## `web`

启动 Web UI（Renderer），可选同时启动 Gateway。

常用选项：`-p` Web 端口、`-g` Gateway 端口、`--no-gateway` 使用已有 Gateway。

---

## `start`

同时启动 Gateway 与 Web UI，并可选打开浏览器。

---

## `auth`

认证与 Token（对应 `AuthController`）。

| 子命令 | 说明 |
|--------|------|
| `login` | `-u` / `-p`，登录 |
| `logout` | 登出 |
| `status` | 状态 |
| `refresh` | 刷新 Token |
| `set-token` | 手动写入 Token |
| `get-token` | 查看本地 Token 摘要 |
| `clear-token` | 清除本地 Token |

默认 `-g ws://localhost:8282`。

---

## `rpc`（别名 `call`）

通过 WebSocket 调用**任意**已注册的 service 命令。

| 选项 | 说明 |
|------|------|
| `[command]` | 如 `tools/list`、`connect`、`setting/load` |
| `-g` | Gateway WebSocket URL |
| `-d` | 请求体 JSON 字符串 |
| `-f` | 从文件读 JSON，与 `-d` 合并（文件覆盖同名字段） |
| `-t` | 超时毫秒 |
| `--list` | 列出已知命令名（与源码 `service-commands` 同步） |
| `-q` | 成功时只打印响应中的 `msg` |

示例：

```bash
openmcp-cli rpc --list
openmcp-cli rpc tools/list -d "{\"clientId\":\"...\"}"
openmcp-cli rpc batch-validation/run -f ./payload.json -t 600000
```

---

## `mcp`

MCP 连接与协议封装（Connect + Client 控制器）。

包含但不限于：`connect`、`disconnect`、`ping`、`lookup-env`、`server-version`、`prompts-list`、`resources-list`、`resources-read`、`tools-list`、`tools-call` 等。

`connect` 支持 `--config` 完整 JSON，或 `--type` + STDIO/SSE/STREAMABLE_HTTP 相关参数。

---

## `llm`

| 子命令 | 对应 service 命令 |
|--------|-------------------|
| `models` | `llm/models` |
| `models-openrouter` | `llm/models/openrouter` |
| `models-dynamic` | `llm/models/dynamic` |
| `chat-sync` | `llm/chat/completions/sync` |
| `abort` | `llm/chat/completions/abort` |

`chat-sync` 支持 `-f` / `-d` 传入完整 body。

---

## `setting`

| 子命令 | 说明 |
|--------|------|
| `load` | 加载设置 |
| `save` | `-f` / `-d` 保存 |
| `set-tour` | `--user-has-read-guide true\|false` |
| `get-tour` | 读取引导状态 |

---

## `panel`

面板与本地持久化配置（`panel/*`、`system-prompts/*`、`variables/*`、`extraction-rules/*`、`test-cases/*`、`batch-validation/load|save` 等）。

多数子命令支持 `-c client-id`、`-d`、`-f`，与前端保存结构一致时请用 **`-f` 指向导出 JSON**。

---

## `skills`

`list`、`load`、`read-file`（参数与 `SkillController` 一致）。

---

## `feedback`

Reflux：`save`、`count`、`list-data`、`find-trace`、`find-tools`。

---

## `batch-validation`

| 子命令 | 说明 |
|--------|------|
| `run` | `-f` / `-d`，执行批量验证（耗时可调 `rpc` 超时） |

---

## `debugger-mcp`

`load`、`save`、`connection-info`、`toggle-tool`。

---

## `ocr`

`get-image`、`start`（支持从 JSON 或 `--image-file` + `--mime-type` 提交图片）。

---

## Service 命令名速查

源码维护列表：`cli/src/lib/service-commands.ts`。新增后端 `@Controller` 时请同步更新该文件与本文档相关段落。
