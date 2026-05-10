import { Command } from 'commander';
import open from 'open';
import { startService, startRenderer, startRendererStatic, stopAll } from '../lib/index.js';
import { HELP_START } from '../lib/help-text.js';

function isWebDevModeEnabled(): boolean {
  const value = (process.env.OPENMCP_WEB_DEV || '').toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export const startCommand = new Command('start')
  .description('Start Gateway + Web UI in one step, with optional browser launch.')
  .addHelpText('after', HELP_START)
  .option('-p, --port <port>', 'Web UI port', '8283')
  .option('-g, --gateway-port <port>', 'Gateway port', '8282')
  .option('-b, --browser <browser>', 'Browser name (passed to the open package)')
  .action(async (options) => {
    const webPort = parseInt(options.port, 10);
    const gatewayPort = parseInt(options.gatewayPort, 10);

    console.log(`
╔═══════════════════════════════════════╗
║      OpenMCP                         ║
║      Gateway + Web UI                 ║
╚═══════════════════════════════════════╝
    `);

    await startService(gatewayPort);

    const renderer = isWebDevModeEnabled()
      ? startRenderer(webPort, gatewayPort)
      : startRendererStatic(webPort, gatewayPort);
    if (!renderer) {
      process.exit(1);
      return;
    }

    // renderer 在 `mode=website` 时 base 为 `/mcp/`，因此需要打开该路径
    const url = `http://localhost:${webPort}/mcp/`;

    console.log(`
🌐 Web UI:     ${url}
🔌 Gateway:    ws://localhost:${gatewayPort}
🧩 Mode:       ${isWebDevModeEnabled() ? 'development (vite)' : 'production (static)'}
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
