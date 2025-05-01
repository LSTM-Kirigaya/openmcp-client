# 创建并清理资源目录
New-Item -ItemType Directory -Path ./resources -Force
Remove-Item -Recurse -Force ./resources/* -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path ./resources -Force

# 获取当前工作目录的绝对路径
$currentDir = (Get-Location).Path

# 并行构建 renderer 和 service
$rendererJob = Start-Job -ScriptBlock {
    param($workDir)
    Set-Location -Path "$workDir\renderer"
    npm run build
    Move-Item -Path "./dist" -Destination "$workDir\resources\renderer" -Force
} -ArgumentList $currentDir

$serviceJob = Start-Job -ScriptBlock {
    param($workDir)
    Set-Location -Path "$workDir\service"
    npm run build
    Move-Item -Path "./dist" -Destination "$workDir\resources\service" -Force
} -ArgumentList $currentDir

# 等待任务完成
$rendererJob | Wait-Job | Receive-Job
$serviceJob | Wait-Job | Receive-Job

# 将 resources 目录复制到 software/resources
New-Item -ItemType Directory -Path ./software/resources -Force
Remove-Item -Recurse -Force ./software/resources/* -ErrorAction SilentlyContinue
Copy-Item -Recurse -Path ./resources -Destination ./software/ -Force

Write-Output "finish building services in ./resources"
