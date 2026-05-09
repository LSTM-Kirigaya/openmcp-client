import { Command } from 'commander';
import open from 'open';
import WebSocket from 'ws';
import {
  startRenderer,
  startRendererBackground,
  startRendererStatic,
  startRendererStaticBackground,
  stopRendererOnly,
  stopRendererService,
  statusRendererService,
} from '../lib/index.js';
import { HELP_WEB } from '../lib/help-text.js';

function wsUrlForPort(port: number): string {
  return `ws://localhost:${port}`;
}

async function waitWebSocketOpen(wsUrl: string, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      reject(new Error(`WebSocket timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.on('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // 连接成功后立刻关闭
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve();
    });

    ws.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      reject(err);
    });
  });
}

async function assertGatewayReachable(gatewayPort: number): Promise<void> {
  const wsUrl = wsUrlForPort(gatewayPort);
  const attempts = 3;
  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      await waitWebSocketOpen(wsUrl, 2000);
      return;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  const reason =
    lastErr instanceof Error ? lastErr.message || String(lastErr) : String(lastErr);
  throw new Error(`Gateway 不可达: ${wsUrl}。原因: ${reason}`);
}

function sharedOptions(cmd: Command) {
  return cmd
    .option('-p, --port <port>', 'Vite 开发服务器端口（Web UI）', '8283')
    .option('-g, --gateway-port <port>', 'Gateway WebSocket 端口', '8282')
    .option('-b, --browser <browser>', '用指定浏览器打开，如 chrome、msedge');
}

function isWebDevModeEnabled(): boolean {
  const value = (process.env.OPENMCP_WEB_DEV || '').toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

async function runWebForeground(options: any) {
  const webPort = parseInt(options.port, 10);
  const gatewayPort = parseInt(options.gatewayPort, 10);
  const devMode = isWebDevModeEnabled();

  console.log(`
╔═══════════════════════════════════════╗
║      OpenMCP Web UI                    ║
║      MCP Server Debug Interface        ║
╚═══════════════════════════════════════╝
  `);

  try {
    await assertGatewayReachable(gatewayPort);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${message}`);
    console.error(`请先启动 Gateway：openmcp gateway start -p ${gatewayPort}`);
    process.exit(1);
    return;
  }

  const uiStatus = await statusRendererService(webPort);
  if (uiStatus.running) {
    console.log(`⚠️  Web UI is already running at http://localhost:${webPort}/mcp/`);
    return;
  }

  const renderer = devMode
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
🔌 Gateway:    ${wsUrlForPort(gatewayPort)}
🧩 Mode:       ${devMode ? 'development (vite)' : 'production (static)'}
📝 Press Ctrl+C 退出（只停止 Web UI）
  `);

  setTimeout(() => {
    console.log(`\n🚀 Opening browser...`);
    if (options.browser) {
      open(url, { app: { name: options.browser } });
    } else {
      open(url);
    }
  }, 3000);

  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping Web UI...');
    await stopRendererOnly(webPort);
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Stopping Web UI...');
    await stopRendererOnly(webPort);
    process.exit(0);
  });
}

async function startWebBackground(options: any) {
  const webPort = parseInt(options.port, 10);
  const gatewayPort = parseInt(options.gatewayPort, 10);
  const devMode = isWebDevModeEnabled();

  console.log(`
╔═══════════════════════════════════════╗
║      OpenMCP Web UI                    ║
║        Starting in background...      ║
╚═══════════════════════════════════════╝
  `);

  try {
    await assertGatewayReachable(gatewayPort);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${message}`);
    console.error(`请先启动 Gateway：openmcp gateway start -p ${gatewayPort}`);
    process.exit(1);
    return;
  }

  const uiStatus = await statusRendererService(webPort);
  if (uiStatus.running) {
    console.log(`⚠️  Web UI is already running at http://localhost:${webPort}/mcp/`);
    return;
  }

  const result = devMode
    ? await startRendererBackground(webPort, gatewayPort)
    : await startRendererStaticBackground(webPort, gatewayPort);
  if (!result.pid) {
    console.error('❌ Web UI failed to start in background.');
    process.exit(1);
    return;
  }

  const url = `http://localhost:${webPort}/mcp/`;
  console.log(`
🌐 Web UI:     ${url}
🔌 Gateway:    ${wsUrlForPort(gatewayPort)}
🧩 Mode:       ${devMode ? 'development (vite)' : 'production (static)'}
📝 Use 'openmcp webui status' to check
  `);

  setTimeout(() => {
    if (options.browser) {
      open(url, { app: { name: options.browser } });
    } else {
      open(url);
    }
  }, 3000);
}

async function restartWebBackground(options: any) {
  const webPort = parseInt(options.port, 10);

  console.log(`
╔═══════════════════════════════════════╗
║      Restarting OpenMCP Web UI        ║
╚═══════════════════════════════════════╝
  `);

  await stopRendererService(webPort);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const stillThere = await statusRendererService(webPort);
  if (stillThere.running) {
    console.error(
      '❌ Web UI 仍在运行，重启中止。请检查进程是否无法结束或端口被占用。'
    );
    process.exit(1);
    return;
  }

  await startWebBackground(options);

  console.log(`\n✅ Web UI restarted`);
}

async function showWebStatus(options: any) {
  const gatewayPort = parseInt(options.gatewayPort ?? '8282', 10);
  const webPort = parseInt(options.port ?? '8283', 10);
  const ui = await statusRendererService(webPort);

  let gatewayReachable = false;
  try {
    await waitWebSocketOpen(wsUrlForPort(gatewayPort), 1500);
    gatewayReachable = true;
  } catch {
    gatewayReachable = false;
  }

  console.log(`
╔═══════════════════════════════════════╗
║      Web UI Status                    ║
╠═══════════════════════════════════════╣
║ Gateway:   ${gatewayReachable ? '✅ Reachable' : '❌ Unreachable'}
║           ${wsUrlForPort(gatewayPort)}
║ Renderer:  ${ui.running ? '✅ Running' : '❌ Not Running'}
║           PID: ${ui.pid ?? '-'}   Port: ${ui.port}
╚═══════════════════════════════════════╝
  `);
}

export const webCommand = new Command('webui')
  .description('OpenMCP Web UI（Renderer）')
  .summary('Web management: run|start|restart|status|stop')
  .addHelpText('after', HELP_WEB);

// 必须携带子命令：不提供子命令时只输出帮助
webCommand.action(() => {
  webCommand.outputHelp();
});

webCommand
  .command('run')
  .description('前台运行（阻塞，Ctrl+C 退出，只停止 Web UI）')
  .option('-p, --port <port>', 'Vite 开发服务器端口（Web UI）', '8283')
  .option('-g, --gateway-port <port>', 'Gateway WebSocket 端口', '8282')
  .option('-b, --browser <browser>', '用指定浏览器打开，如 chrome、msedge')
  .action(async (options) => {
    await runWebForeground(options);
  });

webCommand
  .command('start')
  .description('后台启动（立即返回，只停止 Web UI）')
  .option('-p, --port <port>', 'Vite 开发服务器端口（Web UI）', '8283')
  .option('-g, --gateway-port <port>', 'Gateway WebSocket 端口', '8282')
  .option('-b, --browser <browser>', '用指定浏览器打开，如 chrome、msedge')
  .action(async (options) => {
    await startWebBackground(options);
  });

webCommand
  .command('restart')
  .description('后台重启（先停止再启动，与 start 相同选项）')
  .option('-p, --port <port>', 'Vite 开发服务器端口（Web UI）', '8283')
  .option('-g, --gateway-port <port>', 'Gateway WebSocket 端口', '8282')
  .option('-b, --browser <browser>', '用指定浏览器打开，如 chrome、msedge')
  .action(async (options) => {
    await restartWebBackground(options);
  });

webCommand
  .command('status')
  .description('检查 Gateway 可达性 + Renderer 状态')
  .option('-p, --port <port>', 'Web UI 端口', '8283')
  .option('-g, --gateway-port <port>', 'Gateway WebSocket 端口', '8282')
  .action(async (options) => {
    await showWebStatus(options);
  });

webCommand
  .command('stop')
  .description('停止后台运行的 Web UI')
  .option('-p, --port <port>', 'Web UI 端口', '8283')
  .action(async (options) => {
    const webPort = parseInt(options.port ?? '8283', 10);
    console.log(`
╔═══════════════════════════════════════╗
║      Stopping OpenMCP Web UI          ║
╚═══════════════════════════════════════╝
  `);
    await stopRendererService(webPort);
  });
