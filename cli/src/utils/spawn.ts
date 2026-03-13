import { spawn, SpawnOptions } from 'child_process';
import { logger } from './logger.js';

export interface SpawnResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export function spawnAsync(
  command: string,
  args: string[],
  options: SpawnOptions = {}
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (exitCode, signal) => {
      resolve({ exitCode, signal });
    });

    child.on('error', (err) => {
      logger.error(`Failed to start process: ${err.message}`);
      resolve({ exitCode: 1, signal: null });
    });
  });
}

export function spawnDetached(
  command: string,
  args: string[],
  options: SpawnOptions = {}
) {
  const child = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    detached: true,
    ...options
  });

  return child;
}

// 用于并行运行多个进程的函数
export async function runParallel(
  tasks: Array<{
    name: string;
    command: string;
    args: string[];
    options?: SpawnOptions;
  }>,
  onExit?: (name: string, exitCode: number | null) => void
): Promise<void> {
  const children: Array<{ name: string; process: ReturnType<typeof spawn> }> = [];

  return new Promise((resolve) => {
    let exitedCount = 0;

    const checkAllExited = () => {
      exitedCount++;
      if (exitedCount >= tasks.length) {
        resolve();
      }
    };

    for (const task of tasks) {
      logger.info(`Starting ${task.name}...`);
      
      const child = spawn(task.command, task.args, {
        stdio: 'inherit',
        shell: true,
        ...task.options
      });

      children.push({ name: task.name, process: child });

      child.on('close', (exitCode, signal) => {
        logger.info(`${task.name} exited with code ${exitCode}`);
        if (onExit) {
          onExit(task.name, exitCode);
        }
        checkAllExited();
      });

      child.on('error', (err) => {
        logger.error(`Failed to start ${task.name}: ${err.message}`);
        checkAllExited();
      });
    }

    // 处理 Ctrl+C 信号
    process.on('SIGINT', () => {
      logger.newline();
      logger.info('Shutting down all processes...');
      for (const { name, process: child } of children) {
        try {
          // 在 Windows 上使用 taskkill，在其他平台上使用 SIGTERM
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']);
          } else {
            // 负 PID 会发送信号给进程组
            process.kill(-child.pid!, 'SIGTERM');
          }
        } catch {
          // 进程可能已经退出
        }
      }
      // 给进程一些时间清理，然后强制退出
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    });
  });
}
