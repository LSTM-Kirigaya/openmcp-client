import { Command } from 'commander';
import open from 'open';
import { startService, startRenderer, stopAll } from '../lib/index.js';

export const webCommand = new Command('web')
  .description('Open OpenMCP Web UI');

webCommand
  .option('-p, --port <port>', 'Web UI port', '8283')
  .option('-g, --gateway-port <port>', 'Gateway port', '8282')
  .option('-n, --no-gateway', 'Do not start gateway (use existing)')
  .option('-b, --browser <browser>', 'Browser to open (chrome, firefox, edge, etc.)')
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
