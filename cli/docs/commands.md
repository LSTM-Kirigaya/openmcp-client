# 命令参考

下列为顶层命令；子命令与选项以 **`openmcp <command> --help`** 为准（程序内描述最准确）。

## 全局

```bash
openmcp --help
openmcp -V
```

程序名在代码中为 `openmcp`；`cli/package.json` 的 `bin` 提供 **`openmcp`**。

---

## `gateway`

管理 Gateway 进程（WebSocket 服务）。

| 子命令 | 说明 |
|--------|------|
| `run` | 前台运行，阻塞，便于看日志 |
| `start` | 后台启动 |
| `stop` | 停止后台 Gateway |
| `restart` | 按指定端口重启 |
| `status` | 是否运行、PID、端口 |
| `logs-dir` / `log-dir` | 打印 Gateway 日志目录 |
| `logs` | 打印最近若干行日志 |

常用：`openmcp gateway start -p 8282`

---

## `webui`

启动 Web UI（Renderer）。常用选项：`-p` Web 端口、`-g` Gateway 端口。

| 子命令 | 说明 |
|--------|------|
| `run` | 前台运行 Web UI |
| `start` | 后台启动 Web UI |
| `restart` | 重启 Web UI |
| `status` | 检查 Gateway 可达性与 Renderer 状态 |
| `stop` | 停止 Web UI |

---

## `start`

同时启动 Gateway 与 Web UI，并可选打开浏览器。

---

## `mcp`

MCP Server 配置与运行会话管理。

| 子命令 | 说明 |
|--------|------|
| `server list/get/add/edit/delete` | 本地 MCP Server 配置 CRUD |
| `session connect/list/current/recent/use/disconnect` | 运行会话连接、查看、切换与断开 |

`mcp server add` 支持扁平 JSON 配置，也支持 `mcpServers` 聚合配置并通过 `--mcp-server` 选择目标。

---

## `debug`

MCP 调试与测试命令，均通过 Gateway 转发到 service 控制器。

| 子命令 | 说明 |
|--------|------|
| `tool list/call` | 列出与调用 MCP tools |
| `tool test-case list/get/save/delete` | 工具测试用例 CRUD，支持 `user/workspace` scope |
| `resource list/get/templates` | 列出、读取 resources 与 resource templates |
| `prompt list/get` | 列出与读取 prompts |
| `mcp ping/server-version/lookup-env` | 会话与环境诊断 |
| `mcp config validate/init/export/env-preview` | 配置校验、模板、导出、环境注入预览 |
| `mcp history list/replay` | CLI 请求留痕查询与回放 |
| `batch run` | 执行批量验证 |
| `batch list/get/save/delete` | 批量验证套件 CRUD，支持 `user/workspace` scope |
| `chat start` | 使用已配置 LLM provider 启动 MCP 交互测试 |

依赖 `clientId` 的子命令可省略 `--client-id`，默认使用当前会话。

---

## `setting`

| 子命令 | 说明 |
|--------|------|
| `general list/set/save` | 通用设置查看、单项修改、整包保存 |
| `llm provider list/add/update/delete` | LLM provider CRUD |
| `llm model list/refresh` | 获取或刷新 provider 模型列表 |
| `llm test` | 测试 provider 模型接口连通性 |
| `llm chat` | 同步聊天补全 |

---

## `skills`

`list`、`load`、`read-file`，用于读取 `SKILL_PATH` 指向的本地技能包。

---

## Service 命令名速查

源码维护列表：`cli/src/lib/service-commands.ts`。新增后端 `@Controller` 时请同步更新该文件与本文档相关段落。
