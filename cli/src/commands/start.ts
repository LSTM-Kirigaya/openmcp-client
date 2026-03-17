import { Command } from 'commander';
import open from 'open';
import { startService, startRenderer, stopAll } from '../lib/index.js';

export const startCommand = new Command('start')
  .description('Start both Gateway and Web UI')
  .option('-p, --port <port>', 'Web UI port', '8283')
  .option('-g, --gateway-port <port>', 'Gateway port', '8282')
  .option('-b, --browser <browser>', 'Browser to open')
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
    startRenderer(webPort);

    const url = `http://localhost:${webPort}`;

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
