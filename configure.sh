cd renderer && npm i && cd ..
cd service && npm i && node patch-mcp-sdk.js && cd ..
cd servers && uv sync
npm i