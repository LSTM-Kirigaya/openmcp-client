import { Command } from 'commander';
import { runService, startService, stopService, restartService, statusService } from '../lib/index.js';
import { HELP_GATEWAY } from '../lib/help-text.js';

export const gatewayCommand = new Command('gateway')
  .description('Manage OpenMCP Gateway (service)')
  .summary('Gateway management: run|start|stop|restart|status')
  .description(`
OpenMCP Gateway 管理命令：

  run     前台运行 Gateway（阻塞，查看日志）
  start   后台启动 Gateway（立即返回）
  stop    停止后台运行的 Gateway
  restart 重启 Gateway
  status  查看 Gateway 状态

示例：
  openmcp-cli gateway run           # 前台运行
  openmcp-cli gateway start         # 后台启动
  openmcp-cli gateway stop         # 停止
  openmcp-cli gateway restart      # 重启
  openmcp-cli gateway status       # 查看状态
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
