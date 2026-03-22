import { Command } from 'commander';
import open from 'open';
import { startService, startRenderer, stopAll } from '../lib/index.js';
import { HELP_WEB } from '../lib/help-text.js';

export const webCommand = new Command('web')
  .description('在本机启动 OpenMCP Web 界面（Renderer），可选同时启动 Gateway。')
  .addHelpText('after', HELP_WEB);

webCommand
  .option('-p, --port <port>', 'Vite 开发服务器端口（Web UI）', '8283')
  .option('-g, --gateway-port <port>', '若需顺带启动 Gateway，其监听端口', '8282')
  .option('-n, --no-gateway', '不启动 Gateway（使用已运行的服务）')
  .option('-b, --browser <browser>', '用指定浏览器打开，如 chrome、msedge')
  .action(async (options) => {
    const webPort = parseInt(options.port, 10);
    const gatewayPort = parseInt(options.gatewayPort, 10);
    const startGateway = options.gateway !== false;

    console.log(`
╔═══════════════════════════════════════╗
║      OpenMCP Web UI                    ║
║      MCP Server Debug Interface         ║
╚═══════════════════════════════════════╝
    `);

    // Start gateway if needed
    if (startGateway) {
      startService(gatewayPort);
      console.log('');
    }

    // Start renderer
    const renderer = startRenderer(webPort);

    const url = `http://localhost:${webPort}`;

    console.log(`
🌐 Web UI:     ${url}
🔌 Gateway:    ws://localhost:${gatewayPort}
📝 Press Ctrl+C to stop all services
    `);

    // Open browser after a delay
    setTimeout(() => {
      console.log(`\n🚀 Opening browser...`);
      if (options.browser) {
        open(url, { app: { name: options.browser } });
      } else {
        open(url);
      }
    }, 3000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping all services...');
      stopAll();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Stopping all services...');
      stopAll();
      process.exit(0);
    });
  });
