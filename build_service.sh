#!/bin/bash

mkdir -p ./resources
rm -rf ./resources/
mkdir -p ./resources

(cd ./renderer && npm run build && mv ./dist ../resources/renderer) &
(cd ./service && npm run build && mv ./dist ../resources/service) &

wait

mkdir -p ./software/resources
rm -rf ./software/resources
cp -r ./resources ./software/

echo "finish building services in ./resources"
