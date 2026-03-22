import { spawn, ChildProcess, exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 当前 Node 可执行文件（避免 Windows 上 spawn('node') 因 PATH 找不到而 ENOENT） */
const NODE = process.execPath;

/** cli/dist/lib -> 上三级为 monorepo 根目录 */
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const GATEWAY_DIR = path.join(REPO_ROOT, 'gateway');
const RENDERER_DIR = path.join(REPO_ROOT, 'renderer');
const GATEWAY_ENTRY = path.join(GATEWAY_DIR, 'dist', 'main.js');

// PID 文件路径（位于 cli 包根下）
const PID_FILE = path.join(__dirname, '..', '..', '.gateway.pid');

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
function savePid(pid: number): void {
  fs.writeFileSync(PID_FILE, String(pid), 'utf-8');
}

/**
 * 读取 PID 文件
 */
function readPid(): number | null {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
      return isNaN(pid) ? null : pid;
    }
  } catch (e) {
    // 忽略错误
  }
  return null;
}

/**
 * 删除 PID 文件
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
 * 启动 Gateway 服务
 */
function doStartService(port: number, detached: boolean = false): { pid: number } {
  if (!fs.existsSync(GATEWAY_ENTRY)) {
    console.error(`❌ 找不到 Gateway 构建产物：${GATEWAY_ENTRY}`);
    console.error('   请在仓库中先构建 gateway 包（生成 dist/main.js），例如在 gateway 目录执行：yarn build');
    return { pid: 0 };
  }

  const env = { ...process.env, PORT: String(port) };

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
      savePid(pid);
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
    savePid(pid);
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
  const existingPid = readPid();
  if (existingPid && await isProcessRunning(existingPid)) {
    console.log(`⚠️  Gateway is already running (PID: ${existingPid})`);
    return { pid: existingPid };
  }
  
  const result = doStartService(port, true);
  
  // 等待一下让进程启动
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 检查是否真的启动成功
  const pid = result.pid;
  if (pid && await isProcessRunning(pid)) {
    console.log(`✅ Gateway started (PID: ${pid})`);
    console.log(`🌐 WebSocket: ws://localhost:${port}`);
  } else {
    console.log(`⚠️  Gateway may have failed to start`);
  }
  
  return result;
}

/**
 * 停止 Gateway
 */
export async function stopService(): Promise<boolean> {
  const pid = readPid();
  
  if (!pid) {
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
export async function statusService(): Promise<{ running: boolean; pid: number | null; port: number }> {
  const pid = readPid();
  
  if (pid && await isProcessRunning(pid)) {
    return {
      running: true,
      pid,
      port: 8282
    };
  }
  
  return {
    running: false,
    pid: null,
    port: 8282
  };
}

/**
 * 启动 Renderer（前台运行，阻塞）
 */
export function startRenderer(port: number = 8283): ChildProcess {
  console.log(`🚀 Starting OpenMCP Web UI on port ${port}...`);

  const env = { ...process.env, PORT: String(port) };

  const yarnCmd = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  currentRenderer = spawn(yarnCmd, ['run', 'serve:website'], {
    cwd: RENDERER_DIR,
    env,
    stdio: 'inherit',
    shell: true
  });

  attachSpawnErrorHandler(currentRenderer, 'Web UI (renderer)');

  return currentRenderer;
}

/**
 * 停止所有服务（用于优雅退出）
 */
export function stopAll(): void {
  // 停止前台 Gateway
  if (foregroundProcess) {
    foregroundProcess.kill();
    foregroundProcess = null;
  }
  
  // 停止 Renderer
  if (currentRenderer) {
    currentRenderer.kill();
    currentRenderer = null;
  }
  
  // 清理 PID 文件
  removePidFile();
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
