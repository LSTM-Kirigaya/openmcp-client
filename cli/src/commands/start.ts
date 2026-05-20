import { Command } from 'commander';
import open from 'open';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startService, startRenderer, startRendererStatic, stopAll } from '../lib/index.js';
import { HELP_START } from '../lib/help-text.js';
import { logger } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function isWebDevModeEnabled(): boolean {
  const value = (process.env.OPENMCP_WEB_DEV || '').toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function padEnd(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
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
    const version = readPackageVersion();

    logger.brand(`▲ OpenMCP  v${version}`);
    console.log();

    const gatewayResult = await startService(gatewayPort, true);
    const gatewayUrl = `ws://localhost:${gatewayPort}`;

    const renderer = isWebDevModeEnabled()
      ? startRenderer(webPort, gatewayPort, true)
      : startRendererStatic(webPort, gatewayPort, true);

    if (!renderer) {
      logger.error('Failed to start Web UI.');
      process.exit(1);
      return;
    }

    const webUrl = `http://localhost:${webPort}/`;

    console.log(`  ${padEnd('Gateway', 8)} ${logger.url(gatewayUrl)}`);
    console.log(`  ${padEnd('Web UI', 8)} ${logger.url(webUrl)}`);
    console.log();

    if (gatewayResult.alreadyRunning) {
      logger.info('  Gateway was already running.');
    }

    logger.success('  Ready. Press Ctrl+C to stop.');

    // Open browser
    setTimeout(() => {
      logger.dim('  Opening browser...');
      if (options.browser) {
        open(webUrl, { app: { name: options.browser } });
      } else {
        open(webUrl);
      }
    }, 3000);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log();
      logger.info('  Stopping all services...');
      await stopAll();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log();
      logger.info('  Stopping all services...');
      await stopAll();
      process.exit(0);
    });
  });
