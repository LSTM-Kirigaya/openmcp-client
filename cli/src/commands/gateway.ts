import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import {
  gatewayStartupLogFile,
  gatewayUserLogDir,
  runService,
  startService,
  stopService,
  restartService,
  statusService,
} from '../lib/index.js';
import { HELP_GATEWAY } from '../lib/help-text.js';

export const gatewayCommand = new Command('gateway')
  .description('Manage OpenMCP Gateway (service)')
  .summary('Gateway: run|start|stop|restart|status|logs|logs-dir')
  .description(`
OpenMCP Gateway management commands:

  run       Run Gateway in foreground (blocking, view logs)
  start     Start Gateway in background (returns immediately)
  stop      Stop the running Gateway in background
  restart   Restart Gateway
  status    Check Gateway status
  logs      Print last N lines of log files (gateway.log and gateway-startup.log)
  logs-dir  Print the absolute path of the log directory (alias: log-dir)

The cloud backend address defaults are provided by service/.env.development and service/.env.production;
you can also override them with OPENMCP_API_BASE_URL, service/.env.local, or %USERPROFILE%\\.openmcp\\gateway.env.

Examples:
  openmcp gateway run           # Run in foreground
  openmcp gateway start         # Start in background
  openmcp gateway stop          # Stop
  openmcp gateway restart       # Restart
  openmcp gateway status        # Check status
  openmcp gateway logs-dir      # Log directory path
  openmcp gateway logs -n 500   # Last 500 lines
  openmcp gateway start -p 9000 # Custom port
  `)
  .addHelpText('after', HELP_GATEWAY);

gatewayCommand
  .command('run')
  .description('Run Gateway in foreground (blocking, for viewing logs)')
  .option('-p, --port <port>', 'Gateway port', '8282')
  .action(async (options) => {
    const port = parseInt(options.port, 10);

    console.log(`
╔═══════════════════════════════════════╗
║      OpenMCP Gateway                 ║
║      MCP Server Gateway & Debug Tool ║
╚═══════════════════════════════════════╝
    `);

    runService(port);

    console.log('\n🛑 Gateway stopped');
  });

gatewayCommand
  .command('start')
  .description('Start Gateway in background (returns immediately)')
  .option('-p, --port <port>', 'Gateway port', '8282')
  .action(async (options) => {
    const port = parseInt(options.port, 10);

    console.log(`
╔═══════════════════════════════════════╗
║      OpenMCP Gateway                 ║
║      Starting in background...       ║
╚═══════════════════════════════════════╝
    `);

    await startService(port);

    console.log(`
💡 Tip: 
   - Use 'openmcp gateway status' to check if running
   - Use 'openmcp gateway stop' to stop
   - Use 'openmcp gateway run' to run in foreground
   - File logs: 'openmcp gateway logs-dir' / 'openmcp gateway logs'
    `);
  });

gatewayCommand
  .command('stop')
  .description('Stop the running Gateway')
  .option('-p, --port <port>', 'Gateway port', '8282')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    console.log(`
╔═══════════════════════════════════════╗
║      Stopping Gateway                 ║
╚═══════════════════════════════════════╝
    `);

    await stopService(port);
  });

gatewayCommand
  .command('restart')
  .description('Restart the Gateway')
  .option('-p, --port <port>', 'Gateway port', '8282')
  .action(async (options) => {
    const port = parseInt(options.port, 10);

    console.log(`
╔═══════════════════════════════════════╗
║      Restarting Gateway              ║
╚═══════════════════════════════════════╝
    `);

    await restartService(port);

    console.log(`
✅ Gateway restarted
🌐 WebSocket: ws://localhost:${port}
    `);
  });

gatewayCommand
  .command('status')
  .description('Check Gateway status')
  .option('-p, --port <port>', 'Gateway port', '8282')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const status = await statusService(port);

    if (status.running) {
      const pidText = status.pid === null ? '(external/unknown)' : String(status.pid);
      console.log(`
╔═══════════════════════════════════════╗
║      Gateway Status                   ║
╠═══════════════════════════════════════╣
║  Status:    ✅ Running               ║
║  PID:       ${pidText.padEnd(27)}║
║  Port:      ${String(status.port).padEnd(27)}║
║  WebSocket: ws://localhost:${status.port}         ║
╚═══════════════════════════════════════╝
      `);
    } else {
      console.log(`
╔═══════════════════════════════════════╗
║      Gateway Status                   ║
╠═══════════════════════════════════════╣
║  Status:   ❌ Not Running             ║
╚═══════════════════════════════════════╝

💡 Use 'openmcp gateway start' to start
      `);
    }
  });

gatewayCommand
  .command('logs-dir')
  .alias('log-dir')
  .description('Print Gateway log directory (user .openmcp/logs/gateway)')
  .action(() => {
    console.log(gatewayUserLogDir());
  });

gatewayCommand
  .command('logs')
  .description('Print tail of Gateway log files (gateway.log and gateway-startup.log)')
  .option('-n, --lines <n>', 'line count', '200')
  .action((options) => {
    const dir = gatewayUserLogDir();
    const logFiles = [
      { label: 'gateway.log', file: path.join(dir, 'gateway.log') },
      { label: 'gateway-startup.log', file: gatewayStartupLogFile() },
    ];
    const n = Math.max(1, parseInt(String(options.lines), 10) || 200);
    const existing = logFiles.filter((item) => fs.existsSync(item.file));

    if (existing.length === 0) {
      console.log(`No log file yet: ${path.join(dir, 'gateway.log')}`);
      console.log(`No startup log yet: ${gatewayStartupLogFile()}`);
      console.log('(Background Gateway will write here; use gateway logs-dir to view the directory)');
      return;
    }

    for (const item of existing) {
      console.log(`--- ${item.label}: ${item.file} ---`);
      const raw = fs.readFileSync(item.file, 'utf8');
      const lines = raw.split(/\r?\n/);
      const tail = lines.slice(Math.max(0, lines.length - n));
      console.log(tail.join('\n'));
    }
  });
