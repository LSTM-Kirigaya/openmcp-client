# 开发与调试

## 目录结构（`cli/`）

| 路径 | 说明 |
|------|------|
| `src/index.ts` | Commander 入口，注册各子命令 |
| `src/commands/` | 各命令模块（`gateway`、`rpc`、`mcp` 等） |
| `src/lib/message-bridge.ts` | WebSocket 客户端，请求/响应与 `_id` 配对 |
| `src/lib/service-manager.ts` | Gateway/Web UI 进程启停、PID 文件 |
| `src/lib/service-commands.ts` | `rpc --list` 与文档用的命令列表 |
| `src/lib/cli-helpers.ts` | JSON 解析、打印、`withGateway` 封装 |
| `bin/openmcp-cli.js` | 入口 shebang，加载 `dist/index.js` |
| `dist/` | `yarn build` 输出，运行依赖此目录 |

## 构建

```bash
cd cli
yarn install
yarn build
```

开发时可用：

```bash
yarn dev
```

等价于 `tsc --watch`，修改 `src` 后自动产出 `dist/`。

## 本地调试 CLI

1. 构建后执行：

   ```bash
   node ./bin/openmcp-cli.js gateway --help
   ```

2. 使用 Node 调试器（示例）：

   ```bash
   node --inspect-brk ./bin/openmcp-cli.js rpc --list
   ```

   在 Chrome 打开 `chrome://inspect` 连接调试。

3. 确认 **Gateway 已启动** 后再调试 `rpc`、`mcp` 等需 WebSocket 的命令；否则 `MessageBridge` 会连接失败。

## 与 monorepo 其它包的关系

| 包 | 关系 |
|----|------|
| **`gateway/`** | CLI 的 `gateway` 子命令启动的是 **gateway** 包构建产物（`gateway/dist/main.js`），不是直接启动 `service/src/main.ts`。Gateway 依赖 `@openmcp/service` 做路由。 |
| **`service/`** | 全部 `rpc` 命令字符串与 `service/src/**/*controller.ts` 中 `@Controller('...')` 一致。 |
| **`renderer/`** | `web` / `start` 通过 `service-manager` 在 `renderer` 目录执行 `yarn run serve:website`（脚本名含 `:` 时建议带 `run`）。 |

修改 **service 路由或控制器** 后，需重新构建 **service** 与 **gateway**（按仓库根目录 `turbo` / `yarn build` 流程），再重启 Gateway，CLI 侧无需改代码即可调用新命令（记得更新 `service-commands.ts` 与文档）。

## 新增子命令时的建议

1. 在 `src/commands/` 增加模块，在 `src/commands/index.ts` 与 `src/index.ts` 注册。
2. 若对应新 service 命令，将命令名加入 `src/lib/service-commands.ts`。
3. 更新 `docs/commands.md`（本目录）。

## 常见问题

**Q: `rpc` 报超时？**  
A: 调大 `-t`；或检查 service 是否阻塞、MCP 子进程是否无响应。

**Q: Gateway `start` 提示已运行但端口不对？**  
A: `status` 中端口展示为简化逻辑时，以实际 `gateway` 监听与 `-p` 为准；多实例需自行协调端口与 PID 文件（当前 PID 文件位于 `cli` 包内路径，见 `service-manager.ts`）。
