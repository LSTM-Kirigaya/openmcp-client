# OpenMCP CLI（`openmcp-cli`）

命令行入口，用于**启动 Gateway / Web UI**、以及通过 **WebSocket** 调用与 VSCode 扩展、Web 前端相同的 **service 路由**（`routeMessage`），便于脚本化与本地调试。

## 环境要求

- Node.js **≥ 18**
- 多数子命令依赖 **Gateway 已启动**（默认 `ws://localhost:8282`）

## 从 npm 安装

发布到 npm 后，全局安装即可使用（命令名为 `openmcp-cli` 或 `openmcp`）：

```bash
npm install -g openmcp-cli
openmcp-cli --help
```

依赖里的 `@openmcp/gateway` 使用 **semver**（`^0.0.1`），以便发布到 npm 后能被正常解析；`workspace:*` 仅适用于仓库内 Yarn。

**尚未发布到 npm 时，用 tarball 试装（推荐）**：`openmcp-cli` 依赖 `@openmcp/gateway`，单独 `npm install -g openmcp-cli-0.1.0.tgz` 会从 registry 拉 gateway，**会 404**。请一次性安装三个本地包（npm 会从本地 tarball 满足依赖）：

```bash
# 在仓库根目录：构建并打三个包
node scripts/pack-npm-test.mjs

# 在任意空目录（路径按你本机调整）
mkdir omcp-try && cd omcp-try && npm init -y
npm install ../service/openmcp-service-0.0.1.tgz ../gateway/openmcp-gateway-0.0.1.tgz ../cli/openmcp-cli-0.1.0.tgz
npx openmcp-cli --help
```

仓库根目录也可执行：`yarn pack:npm-test`。

**已发布到 npm 后**：`npm install -g openmcp-cli` 即可；或用 **Verdaccio** 在本地 registry 演练发布顺序（service → gateway → cli）。

## 安装与本地运行（本仓库开发）

文档以 **Yarn** 为例（经典 Yarn 1 或 Yarn Berry 均可）。在仓库根目录安装依赖后，进入 `cli` 目录构建：

```bash
cd cli
yarn install
yarn build
```

若已在 monorepo 根目录执行过 `yarn`，通常只需在 `cli` 下执行 `yarn build`。

全局/本地调用二选一：

```bash
# 直接执行（开发时常用）
node ./bin/openmcp-cli.js --help

# 在 cli 目录下通过 package.json 的 bin 调用
yarn openmcp-cli --help
# 若上式不可用，可改用：yarn run openmcp-cli --help
```

将 `cli` 链到全局或发布前，需先 `yarn build` 生成 `dist/`。

## 一分钟上手

1. 启动 Gateway（默认端口 **8282**，与 `gateway` 包一致）：

   ```bash
   openmcp-cli gateway start
   ```

2. 查看所有可通过 `rpc` 调用的 service 命令名：

   ```bash
   openmcp-cli rpc --list
   ```

3. 在已连接 MCP 的前提下，列出工具（需替换真实 `clientId`）：

   ```bash
   openmcp-cli rpc tools/list -d "{\"clientId\":\"<uuid>\"}"
   ```

更完整的用法、前置条件与典型流程见 **[使用说明](docs/usage.md)**。

## 命令总览

| 分组 | 说明 |
|------|------|
| `gateway` | 前台/后台启停 Gateway、查看状态 |
| `web` / `start` | 拉起 Web UI（及可选 Gateway） |
| `auth` | 登录、登出、Token 与状态 |
| `rpc`（别名 `call`） | **任意** service 命令 + JSON 请求体 |
| `mcp` | 连接、断开、ping、环境变量、tools/prompts/resources |
| `llm` | 模型列表、同步聊天等 |
| `setting` | 读写应用设置、引导状态 |
| `panel` | 面板与本地配置（与 PanelController 对齐） |
| `skills` | 技能包列表与读文件 |
| `feedback` | Reflux 反馈数据 |
| `batch-validation` | 批量验证执行 |
| `debugger-mcp` | 调试器 MCP 配置与连接信息 |
| `ocr` | OCR 图片提交与读取 |

完整子命令与参数说明见 **[命令参考](docs/commands.md)**。

## 开发与调试

本地修改 `cli/src` 后执行 `yarn build`，或使用 `yarn dev`（`tsc --watch`）边改边编译。调试技巧、与 Gateway/Service 的对应关系见 **[开发与调试](docs/development.md)**。

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/usage.md](docs/usage.md) | 使用前提、Gateway 地址、常见流程 |
| [docs/commands.md](docs/commands.md) | 各命令与子命令说明 |
| [docs/development.md](docs/development.md) | 开发、构建、调试、与仓库其它模块关系 |

## 与 VSCode / Web 的一致性

CLI 通过 WebSocket 发送 `{ command, data }`，由 Gateway 调用 `service` 中的 `@Controller` 注册项；与渲染层 `MessageBridge` 走**同一套路由**，并非另一套 HTTP API。
