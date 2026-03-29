import { spawn, ChildProcess, exec } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import WebSocket from 'ws';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);

/** 当前 Node 可执行文件（避免 Windows 上 spawn('node') 因 PATH 找不到而 ENOENT） */
const NODE = process.execPath;

/** cli/dist/lib -> 上三级：npm 下为 node_modules/@openmcp，开发时为仓库根 */
const REPO_ROOT = path.join(__dirname, '..', '..', '..');

function resolveGatewayDir(): string {
  try {
    const pkg = nodeRequire.resolve('@openmcp/gateway/package.json');
    const dir = path.dirname(pkg);
    const entry = path.join(dir, 'dist', 'main.js');
    // 如果安装包缺少产物（如某些环境只包含 src），回退到仓库本地 gateway。
    if (!fs.existsSync(entry)) {
      return path.join(REPO_ROOT, 'gateway');
    }
    return dir;
  } catch {
    return path.join(REPO_ROOT, 'gateway');
  }
}

const GATEWAY_DIR = resolveGatewayDir();
const RENDERER_DIR = path.join(REPO_ROOT, 'renderer');
const RENDERER_DIST_DIR = path.join(RENDERER_DIR, 'dist');
const GATEWAY_ENTRY = path.join(GATEWAY_DIR, 'dist', 'main.js');
const STATIC_WEB_SERVER_ENTRY = path.join(__dirname, 'static-web-server.js');

/** 可选：用户目录下 KEY=VALUE 行文件，供后台启动的 Gateway 继承（避免 PowerShell 与 cmd 环境变量语法混淆） */
export function gatewayEnvFilePath(): string {
  return path.join(os.homedir(), '.openmcp', 'gateway.env');
}

function loadGatewayEnvFile(): Record<string, string> {
  const filePath = gatewayEnvFilePath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) {
        out[key] = val;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** 合并：gateway.env（默认） + 当前进程环境（覆盖文件） + PORT */
function buildGatewayChildEnv(port: number): NodeJS.ProcessEnv {
  const fromFile = loadGatewayEnvFile();
  return {
    ...fromFile,
    ...process.env,
    PORT: String(port)
  } as NodeJS.ProcessEnv;
}

// PID 文件路径（位于 cli 包根下）
const PID_FILE = path.join(__dirname, '..', '..', '.gateway.pid');
const RENDERER_PID_FILE = path.join(__dirname, '..', '..', '.renderer.pid');

type PidMeta = { pid: number; port: number };
type PidReadResult = { pid: number | null; port: number };

async function waitGatewayWebSocketOpen(port: number, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
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

async function isGatewayReachable(port: number): Promise<boolean> {
  try {
    await waitGatewayWebSocketOpen(port, 1500);
    return true;
  } catch {
    return false;
  }
}

function httpGetText(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`HTTP timeout after ${timeoutMs}ms`));
    });
  });
}

async function isOpenMcpWebReachable(port: number): Promise<boolean> {
  try {
    const text = await httpGetText(`http://localhost:${port}/__openmcp_web_health`, 1200);
    const body = JSON.parse(text);
    return body?.app === 'openmcp-web-ui';
  } catch {
    return false;
  }
}

function attachSpawnErrorHandler(proc: ChildProcess, label: string): void {
  proc.on('error', (err: NodeJS.ErrnoException) => {
    console.error(`❌ 无法启动 ${label}：${err.message}`);
    if (err.code === 'ENOENT') {
      console.error(
        `   常见于找不到可执行文件。Gateway 使用当前 Node（${NODE}）启动；若仍失败请检查 gateway 目录与构建产物是否存在。`
      );
    }
  });
}

// 当前前台运行的服务进程
let foregroundProcess: ChildProcess | null = null;
let currentRenderer: ChildProcess | null = null;

/**
 * 保存 PID 到文件
 */
function savePid(pid: number, port: number): void {
  const meta: PidMeta = { pid, port };
  fs.writeFileSync(PID_FILE, JSON.stringify(meta), 'utf-8');
}

/**
 * 读取 Gateway PID 文件（兼容老版本：只存数字）
 */
function readPidMeta(defaultPort: number): PidReadResult {
  try {
    if (fs.existsSync(PID_FILE)) {
      const raw = fs.readFileSync(PID_FILE, 'utf-8').trim();
      if (!raw) {
        return { pid: null, port: defaultPort };
      }

      // 新版本：JSON { pid, port }
      if (raw.startsWith('{')) {
        const meta = JSON.parse(raw) as Partial<PidMeta>;
        const pid = typeof meta.pid === 'number' ? meta.pid : null;
        const port = typeof meta.port === 'number' ? meta.port : defaultPort;
        return { pid, port };
      }

      // 旧版本：纯数字 pid
      const pid = parseInt(raw, 10);
      return { pid: isNaN(pid) ? null : pid, port: defaultPort };
    }
  } catch (e) {
    // 忽略错误
  }

  return { pid: null, port: defaultPort };
}

/**
 * 读取 Renderer PID 文件（兼容老版本：只存数字）
 */
function readRendererPidMeta(defaultPort: number): PidReadResult {
  try {
    if (fs.existsSync(RENDERER_PID_FILE)) {
      const raw = fs.readFileSync(RENDERER_PID_FILE, 'utf-8').trim();
      if (!raw) {
        return { pid: null, port: defaultPort };
      }

      if (raw.startsWith('{')) {
        const meta = JSON.parse(raw) as Partial<PidMeta>;
        const pid = typeof meta.pid === 'number' ? meta.pid : null;
        const port = typeof meta.port === 'number' ? meta.port : defaultPort;
        return { pid, port };
      }

      const pid = parseInt(raw, 10);
      return { pid: isNaN(pid) ? null : pid, port: defaultPort };
    }
  } catch (e) {
    // 忽略错误
  }

  return { pid: null, port: defaultPort };
}

/**
 * 删除 Gateway PID 文件
 */
function removePidFile(): void {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (e) {
    // 忽略错误
  }
}

/**
 * 删除 Renderer PID 文件
 */
function removeRendererPidFile(): void {
  try {
    if (fs.existsSync(RENDERER_PID_FILE)) {
      fs.unlinkSync(RENDERER_PID_FILE);
    }
  } catch (e) {
    // 忽略错误
  }
}

/**
 * 检查进程是否在运行
 */
async function isProcessRunning(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Windows: tasklist, Unix: kill -0
      if (process.platform === 'win32') {
        exec(`tasklist /FI "PID eq ${pid}" /NH`, (err, stdout) => {
          resolve(!err && stdout.includes(pid.toString()));
        });
      } else {
        try {
          process.kill(pid, 0);
          resolve(true);
        } catch {
          resolve(false);
        }
      }
    } catch {
      resolve(false);
    }
  });
}

/**
 * 杀死进程
 */
async function killProcess(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /PID ${pid} /F`, (err) => {
          resolve(!err);
        });
      } else {
        try {
          process.kill(pid, 'SIGTERM');
          resolve(true);
        } catch {
          resolve(false);
        }
      }
    } catch {
      resolve(false);
    }
  });
}

/**
 * 通过监听端口反查进程 PID（跨目录场景兜底）
 */
async function findPidByListeningPort(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      if (process.platform === 'win32') {
        // 优先使用 PowerShell cmdlet，避免 netstat 本地化文本解析不稳定
        const ps = `powershell -NoProfile -NonInteractive -Command "(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)"`;
        exec(ps, (psErr, psStdout) => {
          const pidByPs = parseInt((psStdout || '').trim(), 10);
          if (!psErr && !isNaN(pidByPs)) {
            resolve(pidByPs);
            return;
          }

          // 回退到 netstat 文本解析
          exec(`netstat -ano -p tcp`, (err, stdout) => {
            if (err || !stdout) {
              resolve(null);
              return;
            }

            const lines = stdout.split(/\r?\n/);
            const target = `:${port}`;
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (!trimmed.includes(target)) continue;

              const parts = trimmed.split(/\s+/);
              if (parts.length < 5) continue;
              const proto = (parts[0] || '').toUpperCase();
              const localAddress = parts[1] || '';
              const foreignAddress = parts[2] || '';
              const pidText = parts[4] || '';
              if (proto !== 'TCP') continue;
              if (!localAddress.endsWith(target) && !localAddress.includes(target)) continue;
              if (!/(^|:)(0)$/i.test(foreignAddress)) continue;
              const pid = parseInt(pidText, 10);
              if (!isNaN(pid)) {
                resolve(pid);
                return;
              }
            }
            resolve(null);
          });
        });
        return;
      }

      // macOS / Linux（若 lsof 不存在会走 err 分支）
      exec(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, (err, stdout) => {
        if (err || !stdout) {
          resolve(null);
          return;
        }
        const pid = parseInt(stdout.split(/\r?\n/)[0]?.trim() || '', 10);
        resolve(isNaN(pid) ? null : pid);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * 启动 Gateway 服务
 */
function doStartService(port: number, detached: boolean = false): { pid: number } {
  if (!fs.existsSync(GATEWAY_ENTRY)) {
    console.error(`❌ 找不到 Gateway 构建产物：${GATEWAY_ENTRY}`);
    console.error(
      '   请确认已安装 @openmcp/gateway（npm install openmcp-cli 时会一并安装）；若从源码开发，请在 gateway 目录执行：yarn build'
    );
    return { pid: 0 };
  }

  const env = buildGatewayChildEnv(port);

  if (detached) {
    const child = spawn(NODE, ['dist/main.js'], {
      cwd: GATEWAY_DIR,
      env,
      detached: true,
      stdio: 'ignore'
    });

    attachSpawnErrorHandler(child, 'Gateway');

    child.unref();

    const pid = child.pid || 0;
    if (pid) {
      savePid(pid, port);
    }

    return { pid };
  }

  foregroundProcess = spawn(NODE, ['dist/main.js'], {
    cwd: GATEWAY_DIR,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  attachSpawnErrorHandler(foregroundProcess, 'Gateway');

  const pid = foregroundProcess.pid || 0;
  if (pid) {
    savePid(pid, port);
  }

  return { pid };
}

/**
 * 运行 Gateway（前台运行，阻塞）
 */
export function runService(port: number = 8282): { pid: number } {
  console.log(`🚀 Running OpenMCP Gateway on port ${port}...`);
  
  const result = doStartService(port, false);
  
  console.log(`
╔═══════════════════════════════════════╗
║      OpenMCP Gateway (Running)        ║
║      WebSocket: ws://localhost:${port}        ║
║      Press Ctrl+C to stop             ║
╚═══════════════════════════════════════╝
  `);
  
  return result;
}

/**
 * 启动 Gateway（后台运行，立即返回）
 */
export async function startService(port: number = 8282): Promise<{ pid: number }> {
  console.log(`🚀 Starting OpenMCP Gateway on port ${port}...`);
  
  // 检查是否已经在运行
  const { pid: existingPid } = readPidMeta(port);
  if (existingPid && await isProcessRunning(existingPid)) {
    console.log(`⚠️  Gateway is already running (PID: ${existingPid})`);
    return { pid: existingPid };
  }

  // PID 文件缺失或失效时，仍通过 WebSocket 可达性识别已运行的 Gateway
  if (await isGatewayReachable(port)) {
    console.log(`⚠️  Gateway is already reachable at ws://localhost:${port} (no local PID record)`);
    return { pid: 0 };
  }
  
  const result = doStartService(port, true);
  
  // 等待一下让进程启动
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 检查是否真的启动成功
  const pid = result.pid;
  if (pid && await isProcessRunning(pid)) {
    console.log(`✅ Gateway started (PID: ${pid})`);
    console.log(`🌐 WebSocket: ws://localhost:${port}`);
  } else if (await isGatewayReachable(port)) {
    console.log(`✅ Gateway is reachable at ws://localhost:${port}`);
  } else {
    console.log(`⚠️  Gateway may have failed to start`);
  }
  
  return result;
}

/**
 * 停止 Gateway
 */
export async function stopService(port: number = 8282): Promise<boolean> {
  const { pid } = readPidMeta(port);
  
  if (!pid) {
    if (await isGatewayReachable(port)) {
      const detectedPid = await findPidByListeningPort(port);
      if (detectedPid) {
        console.log(`⚠️  No local PID record found, fallback to port detection (PID: ${detectedPid}).`);
        const success = await killProcess(detectedPid);
        if (success) {
          console.log(`✅ Gateway stopped by port lookup`);
          removePidFile();
          return true;
        }
        console.log(`❌ Failed to stop detected process (PID: ${detectedPid}).`);
        console.log(`   This may require elevated privilege or a different user session.`);
        return false;
      }

      console.log(`⚠️  Gateway is reachable at ws://localhost:${port}, but PID could not be resolved from port.`);
      console.log(`   Please stop it from the terminal/session where it was started.`);
      return false;
    }
    console.log(`ℹ️  No Gateway PID found. Is it running?`);
    return false;
  }
  
  if (!(await isProcessRunning(pid))) {
    console.log(`ℹ️  Gateway process (PID: ${pid}) is not running`);
    removePidFile();
    return false;
  }
  
  console.log(`🛑 Stopping Gateway (PID: ${pid})...`);
  
  const success = await killProcess(pid);
  
  if (success) {
    console.log(`✅ Gateway stopped`);
    removePidFile();
  } else {
    console.log(`❌ Failed to stop Gateway`);
  }
  
  return success;
}

/**
 * 重启 Gateway
 */
export async function restartService(port: number = 8282): Promise<boolean> {
  console.log(`🔄 Restarting Gateway...`);
  
  await stopService();
  
  // 等待一下让进程完全退出
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await startService(port);
  
  return true;
}

/**
 * 检查 Gateway 状态
 */
export async function statusService(port: number = 8282): Promise<{ running: boolean; pid: number | null; port: number }> {
  const { pid } = readPidMeta(port);
  
  if (pid && await isProcessRunning(pid)) {
    return {
      running: true,
      pid,
      port
    };
  }

  // 兼容“Gateway 在其它目录/其它 CLI 启动，没有本地 PID 文件”的场景
  if (await isGatewayReachable(port)) {
    return {
      running: true,
      pid: null,
      port
    };
  }
  
  return {
    running: false,
    pid: null,
    port
  };
}

/**
 * 启动 Renderer（前台运行，阻塞）
 */
export function startRenderer(port: number = 8283, gatewayPort: number = 8282): ChildProcess {
  console.log(`🚀 Starting OpenMCP Web UI on port ${port} (gateway ws://localhost:${gatewayPort})...`);

  const env = {
    ...process.env,
    PORT: String(port),
    // 让前端使用正确 gateway 端口的 WebSocket（避免读取默认 .env 导致串口）
    VITE_WEBSOCKET_URL: `ws://localhost:${gatewayPort}`
  };

  const yarnCmd = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  currentRenderer = spawn(yarnCmd, ['run', 'serve:website'], {
    cwd: RENDERER_DIR,
    env,
    stdio: 'inherit',
    shell: true
  });

  attachSpawnErrorHandler(currentRenderer, 'Web UI (renderer)');

  const pid = currentRenderer.pid || 0;
  if (pid) {
    saveRendererPid(pid, port);
  }

  return currentRenderer;
}

/**
 * 启动 Renderer（生产模式：静态托管，前台运行）
 */
export function startRendererStatic(port: number = 8283, gatewayPort: number = 8282): ChildProcess | null {
  if (!fs.existsSync(RENDERER_DIST_DIR)) {
    console.error(`❌ renderer dist not found: ${RENDERER_DIST_DIR}`);
    console.error(`   请先构建：cd ${RENDERER_DIR} && yarn run build:website`);
    return null;
  }

  console.log(`🚀 Starting OpenMCP Web UI (static) on port ${port} (gateway ws://localhost:${gatewayPort})...`);

  const env = {
    ...process.env,
    PORT: String(port),
    RENDERER_DIST_DIR,
    // 提供给前端运行时（若页面中读取）
    VITE_WEBSOCKET_URL: `ws://localhost:${gatewayPort}`
  };

  currentRenderer = spawn(NODE, [STATIC_WEB_SERVER_ENTRY], {
    cwd: RENDERER_DIR,
    env,
    stdio: 'inherit',
    shell: false,
    windowsHide: true
  });

  attachSpawnErrorHandler(currentRenderer, 'Web UI static server');

  const pid = currentRenderer.pid || 0;
  if (pid) {
    saveRendererPid(pid, port);
  }

  return currentRenderer;
}

/**
 * 保存 Renderer PID 到文件
 */
function saveRendererPid(pid: number, port: number): void {
  const meta: PidMeta = { pid, port };
  fs.writeFileSync(RENDERER_PID_FILE, JSON.stringify(meta), 'utf-8');
}

/**
 * 启动 Renderer（后台运行）
 */
export async function startRendererBackground(port: number = 8283, gatewayPort: number = 8282): Promise<{ pid: number }> {
  console.log(`🚀 Starting OpenMCP Web UI (background) on port ${port} (gateway ws://localhost:${gatewayPort})...`);

  const { pid: existingPid, port: existingPort } = readRendererPidMeta(port);
  if (existingPid && existingPort === port && await isProcessRunning(existingPid)) {
    console.log(`⚠️  Renderer is already running (PID: ${existingPid})`);
    return { pid: existingPid };
  }
  if (await isOpenMcpWebReachable(port)) {
    console.log(`⚠️  Web UI is already reachable at http://localhost:${port}/mcp/ (no local PID record)`);
    return { pid: 0 };
  }

  const env = {
    ...process.env,
    PORT: String(port),
    // 让前端使用正确 gateway 端口的 WebSocket
    VITE_WEBSOCKET_URL: `ws://localhost:${gatewayPort}`
  };
  const isWin = process.platform === 'win32';
  const command = isWin ? 'powershell.exe' : 'yarn';
  const args = isWin
    ? ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', `yarn run serve:website -- --port ${port} --strictPort`]
    : ['run', 'serve:website', '--', '--port', String(port), '--strictPort'];

  const child = spawn(command, args, {
    cwd: RENDERER_DIR,
    env,
    detached: true,
    stdio: 'ignore',
    shell: false,
    windowsHide: true
  });

  attachSpawnErrorHandler(child, 'Web UI (renderer)');
  child.unref();

  const pid = child.pid || 0;
  if (pid) {
    saveRendererPid(pid, port);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (pid && await isProcessRunning(pid)) {
    console.log(`✅ Renderer started (PID: ${pid})`);
  } else {
    console.log(`⚠️  Renderer may have failed to start`);
  }

  return { pid };
}

/**
 * 启动 Renderer（生产模式：静态托管，后台运行）
 */
export async function startRendererStaticBackground(port: number = 8283, gatewayPort: number = 8282): Promise<{ pid: number }> {
  console.log(`🚀 Starting OpenMCP Web UI (static background) on port ${port} (gateway ws://localhost:${gatewayPort})...`);

  const { pid: existingPid, port: existingPort } = readRendererPidMeta(port);
  if (existingPid && existingPort === port && await isProcessRunning(existingPid)) {
    console.log(`⚠️  Renderer is already running (PID: ${existingPid})`);
    return { pid: existingPid };
  }
  if (await isOpenMcpWebReachable(port)) {
    console.log(`⚠️  Web UI is already reachable at http://localhost:${port}/mcp/ (no local PID record)`);
    return { pid: 0 };
  }

  if (!fs.existsSync(RENDERER_DIST_DIR)) {
    console.error(`❌ renderer dist not found: ${RENDERER_DIST_DIR}`);
    console.error(`   请先构建：cd ${RENDERER_DIR} && yarn run build:website`);
    return { pid: 0 };
  }

  const env = {
    ...process.env,
    PORT: String(port),
    RENDERER_DIST_DIR,
    VITE_WEBSOCKET_URL: `ws://localhost:${gatewayPort}`
  };

  const child = spawn(NODE, [STATIC_WEB_SERVER_ENTRY], {
    cwd: RENDERER_DIR,
    env,
    detached: true,
    stdio: 'ignore',
    shell: false,
    windowsHide: true
  });

  attachSpawnErrorHandler(child, 'Web UI static server');
  child.unref();

  const pid = child.pid || 0;
  if (pid) {
    saveRendererPid(pid, port);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (pid && await isProcessRunning(pid)) {
    console.log(`✅ Renderer started (PID: ${pid})`);
  } else {
    console.log(`⚠️  Renderer may have failed to start`);
  }

  return { pid };
}

/**
 * 停止 Renderer（后台）
 */
export async function stopRendererService(port: number = 8283): Promise<boolean> {
  const { pid } = readRendererPidMeta(port);

  if (!pid) {
    if (await isOpenMcpWebReachable(port)) {
      const detectedPid = await findPidByListeningPort(port);
      if (detectedPid) {
        console.log(`⚠️  No local PID record found, fallback to port detection (PID: ${detectedPid}).`);
        const success = await killProcess(detectedPid);
        if (success) {
          console.log(`✅ Renderer stopped by port lookup`);
          removeRendererPidFile();
          return true;
        }
        console.log(`❌ Failed to stop detected process (PID: ${detectedPid}).`);
        return false;
      }
      console.log(`⚠️  Web UI is reachable at http://localhost:${port}/mcp/, but PID could not be resolved from port.`);
      return false;
    }
    console.log(`ℹ️  No Renderer PID found. Is it running?`);
    return false;
  }

  if (!(await isProcessRunning(pid))) {
    console.log(`ℹ️  Renderer process (PID: ${pid}) is not running`);
    removeRendererPidFile();
    return false;
  }

  console.log(`🛑 Stopping Renderer (PID: ${pid})...`);
  const success = await killProcess(pid);
  if (success) {
    console.log(`✅ Renderer stopped`);
    removeRendererPidFile();
  } else {
    console.log(`❌ Failed to stop Renderer`);
  }
  return success;
}

/**
 * 检查 Renderer 状态
 */
export async function statusRendererService(port: number = 8283): Promise<{ running: boolean; pid: number | null; port: number }> {
  const { pid } = readRendererPidMeta(port);

  if (pid && await isProcessRunning(pid)) {
    return { running: true, pid, port };
  }

  if (await isOpenMcpWebReachable(port)) {
    const detectedPid = await findPidByListeningPort(port);
    return { running: true, pid: detectedPid, port };
  }

  return { running: false, pid: null, port };
}

/**
 * 停止所有服务（用于优雅退出）
 */
export async function stopAll(): Promise<void> {
  // 停止前台 Gateway
  if (foregroundProcess) {
    foregroundProcess.kill();
    foregroundProcess = null;
  }
  
  // 停止 Renderer（前台/后台）
  await stopRendererOnly();

  // 停止后台 Gateway（若有）
  const gatewayMeta = readPidMeta(8282);
  if (gatewayMeta.pid && (await isProcessRunning(gatewayMeta.pid))) {
    await killProcess(gatewayMeta.pid);
  }

  // 清理 PID 文件（gateway）
  removePidFile();
}

/**
 * 只停止 Renderer（前台/后台），不动 Gateway
 */
export async function stopRendererOnly(port: number = 8283): Promise<void> {
  // 停止前台 Renderer
  if (currentRenderer) {
    currentRenderer.kill();
    currentRenderer = null;
  }

  // 停止后台 Renderer
  const rendererMeta = readRendererPidMeta(port);
  if (rendererMeta.pid && (await isProcessRunning(rendererMeta.pid))) {
    await killProcess(rendererMeta.pid);
  } else if (await isOpenMcpWebReachable(port)) {
    const detectedPid = await findPidByListeningPort(port);
    if (detectedPid) {
      await killProcess(detectedPid);
    }
  }

  // 清理 PID 文件（renderer）
  removeRendererPidFile();
}

/**
 * 获取当前前台运行的 Gateway 进程
 */
export function getForegroundProcess(): ChildProcess | null {
  return foregroundProcess;
}

/**
 * 获取当前 Renderer 进程
 */
export function getCurrentRenderer(): ChildProcess | null {
  return currentRenderer;
}
