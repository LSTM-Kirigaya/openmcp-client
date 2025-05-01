# 安装 renderer 依赖
Set-Location renderer
npm i
Set-Location ..

# 安装 service 依赖并打补丁
Set-Location service
npm i
node patch-mcp-sdk.js
Set-Location ..

Set-Location servers
uv sync
Set-Location ..

# 安装根目录依赖
npm i