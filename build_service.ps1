# 创建并清理资源目录
New-Item -ItemType Directory -Path ./resources -Force
Remove-Item -Recurse -Force ./resources/*
New-Item -ItemType Directory -Path ./resources -Force

# 并行构建 renderer 和 service
$rendererJob = Start-Job -ScriptBlock {
    cd ./renderer
    npm run build
    mv ./dist ../resources/renderer
}

$serviceJob = Start-Job -ScriptBlock {
    cd ./service
    npm run build
    mv ./dist ../resources/service
}

# 等待任务完成
$rendererJob | Wait-Job | Receive-Job
$serviceJob | Wait-Job | Receive-Job

Write-Output "finish building services in ./resources"
