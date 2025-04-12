#!/bin/bash

mkdir -p ./resources
(cd ./renderer && npm run build && mv ./dist ../resources/renderer) &
(cd ./service && npm run build && mv ./dist ../resources/service) &
wait
echo "finish building services in ./resources"
