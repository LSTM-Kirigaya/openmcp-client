import { Command } from 'commander';
import open from 'open';
import { startService, startRenderer, stopAll } from '../lib/index.js';
import { HELP_START } from '../lib/help-text.js';

export const startCommand = new Command('start')
  .description('一键启动 Gateway + Web UI，并可选打开浏览器。')
  .addHelpText('after', HELP_START)
  .option('-p, --port <port>', 'Web UI 端口', '8283')
  .option('-g, --gateway-port <port>', 'Gateway 端口', '8282')
  .option('-b, --browser <browser>', '浏览器名称（传给 open 包）')
  .action(async (options) => {
    const webPort = parseInt(options.port, 10);
    const gatewayPort = parseInt(options.gatewayPort, 10);

    console.log(`
╔═══════════════════════════════════════╗
║      OpenMCP                         ║
║      Gateway + Web UI                 ║
╚═══════════════════════════════════════╝
    `);

    // Start gateway
    startService(gatewayPort);

    // Wait a bit for gateway to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start renderer
    startRenderer(webPort, gatewayPort);

    // renderer 在 `mode=website` 时 base 为 `/mcp/`，因此需要打开该路径
    const url = `http://localhost:${webPort}/mcp/`;

    console.log(`
🌐 Web UI:     ${url}
🔌 Gateway:    ws://localhost:${gatewayPort}
📝 Press Ctrl+C to stop all services
    `);

    // Open browser
    setTimeout(() => {
      console.log(`\n🚀 Opening browser...`);
      if (options.browser) {
        open(url, { app: { name: options.browser } });
      } else {
        open(url);
      }
    }, 3000);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping all services...');
      await stopAll();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Stopping all services...');
      await stopAll();
      process.exit(0);
    });
  });
