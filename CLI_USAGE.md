# OpenMCP CLI 使用说明

## 项目概述

OpenMCP CLI 是一个命令行工具，允许用户通过 `npm install -g @agent-ruler/openmcp` 全局安装，并使用 `omc` 命令快速搭建和运行 OpenMCP 开发环境。

## 功能特性

- ✅ `omc init` - 一键初始化 OpenMCP 项目
- ✅ `omc dev` - 启动开发模式（前后端并行运行）
- ✅ `omc start` - 启动生产模式
- ✅ `omc update` - 检查并更新到最新版本
- ✅ 支持 npm/yarn/pnpm 多种包管理器
- ✅ 自动检测项目结构
- ✅ 友好的错误提示和日志输出

## 文件结构

```
cli/
├── bin/
│   └── omc          # CLI 入口脚本 (可执行)
├── src/
│   ├── index.ts             # 主入口，命令注册
│   ├── commands/
│   │   ├── init.ts          # init 命令实现
│   │   ├── dev.ts           # dev 命令实现
│   │   ├── start.ts         # start 命令实现
│   │   └── update.ts        # update 命令实现
│   └── utils/
│       ├── version.ts       # 版本管理
│       ├── logger.ts        # 日志输出
│       ├── spawn.ts         # 进程管理
│       └── download.ts      # 仓库克隆和依赖安装
├── package.json             # CLI 包配置
├── tsconfig.json            # TypeScript 配置
├── .npmignore               # npm 发布忽略文件
└── README.md                # CLI 文档
```

## 构建流程

### 1. 快速构建（开发模式）

```bash
# 进入 cli 目录
cd cli

# 安装依赖
npm install

# 构建 TypeScript
npm run build

# 测试构建结果
node bin/omc --version
```

### 2. 完整构建（推荐）

```bash
# 在项目根目录执行
npm run build:cli:full

# 这个脚本会：
# 1. 安装 CLI 依赖
# 2. 编译 TypeScript
# 3. 设置可执行权限
# 4. 验证构建输出
```

### 3. 测试构建

```bash
# 在项目根目录执行
npm run test:cli

# 这个脚本会：
# 1. 构建 CLI
# 2. 测试版本输出
# 3. 测试帮助文档
# 4. 测试 init 命令帮助
# 5. 测试 npm pack 打包
```

## 发布流程

### 1. 准备发布

```bash
# 确保所有代码已提交到 git
git add .
git commit -m "Prepare CLI release v0.1.0"

# 更新版本号（在 cli/package.json 中）
# 遵循语义化版本规范：major.minor.patch
```

### 2. 构建和测试

```bash
# 完整构建
npm run build:cli:full

# 运行测试
npm run test:cli
```

### 3. 本地测试（可选）

```bash
# 在 cli 目录中创建全局链接
cd cli
npm link

# 现在可以在任意位置使用 omc 命令
omc --version
omc --help

# 解除链接（测试完成后）
npm unlink -g @agent-ruler/openmcp
```

### 4. 发布到 npm

```bash
# 方法 1: 使用根目录的脚本
npm run publish:cli

# 方法 2: 手动发布
cd cli
npm login                    # 登录 npm（如未登录）
npm publish                  # 发布包
npm publish --access public  # 如果是 scoped 包 (@scope/name)
```

### 5. 验证发布

```bash
# 全局安装测试
npm install -g @agent-ruler/openmcp

# 验证安装
omc --version
which omc

# 卸载
npm uninstall -g omc
```

## 用户使用指南

### 安装

```bash
npm install -g @agent-ruler/openmcp
```

### 创建新项目

```bash
# 创建新项目
omc init my-mcp-project

# 进入项目目录
cd my-mcp-project
```

### 开发模式

```bash
# 启动前后端（推荐）
omc dev

# 只启动后端服务
omc dev --service-only

# 只启动前端渲染器
omc dev --renderer-only

# 指定端口
omc dev --port 9000
```

### 生产模式

```bash
# 构建并启动生产服务
omc start

# 指定端口
omc start --port 9000
```

### 更新项目

```bash
# 检查更新
omc update --check

# 更新到最新版本
omc update
```

## 常见问题

### Q1: 全局安装失败（权限错误）

**解决方案：**
```bash
# 方法 1: 使用 npx（无需全局安装）
npx @agent-ruler/openmcp init my-project

# 方法 2: 修改 npm 默认目录
# 参考: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally

# 方法 3: 使用 nvm 管理 Node.js
# nvm 会自动处理权限问题
```

### Q2: 找不到命令

**检查：**
```bash
# 确认全局安装路径在 PATH 中
npm config get prefix

# 确认可执行文件存在
ls -la $(npm config get prefix)/bin/omc

# 重新安装
npm uninstall -g omc
npm install -g @agent-ruler/openmcp
```

### Q3: 项目初始化失败

**检查：**
```bash
# 确认 git 已安装
git --version

# 确认网络连接
curl -I https://github.com

# 手动初始化
git clone --depth 1 https://github.com/LSTM-Kirigaya/openmcpent.git my-project
cd my-project
npm install
```

## 版本更新策略

1. **Patch (0.1.x)**: Bug 修复、文档更新
2. **Minor (0.x.0)**: 新功能、向后兼容的更改
3. **Major (x.0.0)**: 破坏性更改、重大架构调整

## 后续扩展计划

- [ ] 支持自定义模板（`omc init --template vue`）
- [ ] 支持项目配置导入/导出
- [ ] 集成 Docker 部署
- [ ] 支持插件系统
- [ ] 添加配置向导（交互式设置）

## 相关链接

- [OpenMCP 官方文档](https://openmcp.kirigaya.cn)
- [GitHub 仓库](https://github.com/LSTM-Kirigaya/openmcpent)
- [npm 包页面](https://www.npmjs.com/package/omc)
