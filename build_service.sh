#!/bin/bash

mkdir -p ./resources
(cd ./renderer && npm run build && mv ./dist ../resources/renderer) &
(cd ./service && npm run build && mv ./dist ../resources/service) &
wait
echo "构建完成，dist文件已移动到resources目录"