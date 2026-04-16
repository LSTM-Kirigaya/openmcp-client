# `openmcp-client/service` 功能点盘点

基于 `openmcp-client/service/src` 的目录与控制器拆分，现有能力域如下：

## 1. MCP 连接与调用

- 连接管理：`connect.service.ts`、`connect.controller.ts`
- 客户端调用：`client.service.ts`、`client.controller.ts`、`client.dto.ts`
- 连接监控：`connect-monitor.service.ts`、`file-monitor.service.ts`
- OCR 与鉴权：`ocr.*`、`auth.service.ts`（MCP 内部鉴权辅助）

## 2. 认证模块（应用级 Auth）

- 用户登录/注册/会话刷新：`auth/auth.service.ts`
- 控制器与 DTO：`auth/auth.controller.ts`、`auth/auth.dto.ts`

## 3. 云备份

- 备份创建/列举/恢复/删除/详情：`cloud-backup/*`
- 加密逻辑：`crypto.service.ts`

## 4. 设置与面板状态

- 设置模块：`setting/*`
- 面板状态与批量校验关联仓储：`panel/*`

## 5. LLM 与 Hook 扩展

- LLM 控制器与服务：`llm/*`
- Hook 适配层：`hook/*`（adapter/openrouter/sdk 等）

## 6. 反馈与回流（Reflux）

- `feedback/reflux.controller.ts`
- `feedback/reflux.service.ts`
- `feedback/reflux.repository.ts`

## 7. Debugger MCP

- 调试服务、存储、控制器：`debugger-mcp/*`

## 8. 批量验证

- `batch-validation/*`：批量任务创建与执行编排

## 9. 公共基础设施

- 路由注册：`common/router.ts`
- 存储基建：`json-archive-store.ts`、`omdb-store.ts`、`unified-chunk-store.ts`

## 10. 已有测试

- `common/json-archive-store.test.ts`
- `feedback/reflux.test.ts`

---

该清单已用于 `software/service-rust` 的重写骨架分域（inventory endpoint + 对应 domain 模块）。
