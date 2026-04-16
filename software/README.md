# OpenMCP Software

该目录是 `openmcp-client` 的软件化工作区初始化结果。

## 前端复用策略

- 当前软件前端直接复用 `openmcp-client/renderer`。
- `software/package.json` 里的 `dev/build/preview` 均转发到 `../renderer`，确保样式和功能尽量保持一致。

## Rust Service 重写位置

- 新的 Rust 重写骨架位于 `software/service-rust`。
- 目标是对齐 `openmcp-client/service` 的主要能力域（MCP、Auth、Cloud Backup、Settings、LLM、Feedback、Panel、Batch Validation、Debugger MCP）。

## 使用方式

```bash
cd openmcp-client/software
npm run dev
```

```bash
cd openmcp-client/software
npm run build
npm run build:service
npm run test:service
```
