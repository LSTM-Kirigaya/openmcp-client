import { spawn, ChildProcess, exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// PID 文件路径
const PID_FILE = path.join(__dirname, '..', '..', '.gateway.pid');

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
  const env = { ...process.env, PORT: String(port) };
  
  if (detached) {
    // 后台运行：创建一个新的进程组
    const child = spawn('node', ['dist/main.js'], {
      cwd: path.join(__dirname, '..', 'service'),
      env,
      detached: true,
      stdio: 'ignore'
    });
    
    // 不等待子进程，直接返回
    child.unref();
    
    // 保存 PID
    const pid = child.pid || 0;
    savePid(pid);
    
    return { pid };
  } else {
    // 前台运行
    foregroundProcess = spawn('node', ['dist/main.js'], {
      cwd: path.join(__dirname, '..', 'service'),
      env,
      stdio: 'inherit',
      shell: true
    });
    
    // 保存 PID
    const pid = foregroundProcess.pid || 0;
    savePid(pid);
    
    return { pid };
  }
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

  currentRenderer = spawn('npm', ['run', 'serve:website'], {
    cwd: path.join(__dirname, '..', 'renderer'),
    stdio: 'inherit',
    shell: true
  });

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
