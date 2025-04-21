npx concurrently `
    -n "renderer,service" `
    -p " {name} " `
    -c "black.bgBlue,black.bgGreen" `
    --kill-others `
    "cd renderer && npm run serve" `
    "cd service && npm run serve"