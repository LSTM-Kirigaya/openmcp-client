import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { gatewayUserLogDir } from '@openmcp/gateway';
import { runService, startService, stopService, restartService, statusService } from '../lib/index.js';
import { HELP_GATEWAY } from '../lib/help-text.js';

export const gatewayCommand = new Command('gateway')
  .description('Manage OpenMCP Gateway (service)')
  .summary('Gateway: run|start|stop|restart|status|logs|logs-dir')
  .description(`
OpenMCP Gateway 管理命令：

  run       前台运行 Gateway（阻塞，查看日志）
  start     后台启动 Gateway（立即返回）
  stop      停止后台运行的 Gateway
  restart   重启 Gateway
  status    查看 Gateway 状态
  logs      查看最近若干行文件日志（默认 %USERPROFILE%\\.openmcp\\logs\\gateway\\gateway.log）
  logs-dir  仅打印上述日志目录绝对路径（别名: log-dir）

云端/本地后端默认：非 production 时走本地 8000；构建产物 NODE_ENV=production 走远程。可用 OPENMCP_APP_ENV、OPENMCP_API_BASE_URL 或 service/.env、%USERPROFILE%\\.openmcp\\gateway.env 覆盖。

示例：
  openmcp-cli gateway run           # 前台运行
  openmcp-cli gateway start         # 后台启动
  openmcp-cli gateway stop         # 停止
  openmcp-cli gateway restart      # 重启
  openmcp-cli gateway status       # 查看状态
  openmcp-cli gateway logs-dir     # 日志目录路径
  openmcp-cli gateway logs -n 500  # 最近 500 行
  openmcp-cli gateway start -p 9000  # 自定义端口
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
   - Use 'openmcp-cli gateway status' to check if running
   - Use 'openmcp-cli gateway stop' to stop
   - Use 'openmcp-cli gateway run' to run in foreground
   - File logs: 'openmcp-cli gateway logs-dir' / 'openmcp-cli gateway logs'
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

💡 Use 'openmcp-cli gateway start' to start
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
  .description('Print tail of Gateway log file (gateway.log)')
  .option('-n, --lines <n>', 'line count', '200')
  .action((options) => {
    const dir = gatewayUserLogDir();
    const logFile = path.join(dir, 'gateway.log');
    const n = Math.max(1, parseInt(String(options.lines), 10) || 200);

    if (!fs.existsSync(logFile)) {
      console.log(`尚无日志文件: ${logFile}`);
      console.log('（后台 Gateway 写入此处；可用 gateway logs-dir 查看目录）');
      return;
    }

    const raw = fs.readFileSync(logFile, 'utf8');
    const lines = raw.split(/\r?\n/);
    const tail = lines.slice(Math.max(0, lines.length - n));
    console.log(tail.join('\n'));
  });
