import { resolve, join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { runParallel } from '../utils/spawn.js';

interface StartOptions {
  port: string;
}

export async function startCommand(projectPath: string, options: StartOptions): Promise<void> {
  const resolvedPath = resolve(projectPath);

  logger.title('🚀 Starting OpenMCP Production Mode\n');

  // 验证项目结构
  const serviceDistDir = join(resolvedPath, 'service', 'dist');
  const rendererDistDir = join(resolvedPath, 'renderer', 'dist');
  const packageJsonPath = join(resolvedPath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    logger.error(`No package.json found in ${resolvedPath}`);
    logger.info('Make sure you are in an OpenMCP project directory.');
    process.exit(1);
  }

  // 检查是否已构建
  let needsBuild = false;
  
  if (!existsSync(serviceDistDir)) {
    logger.warning('Service build not found. Need to build first.');
    needsBuild = true;
  }
  
  if (!existsSync(rendererDistDir)) {
    logger.warning('Renderer build not found. Need to build first.');
    needsBuild = true;
  }

  // 检测包管理器
  let packageManager = 'npm';
  if (existsSync(join(resolvedPath, 'yarn.lock'))) {
    packageManager = 'yarn';
  } else if (existsSync(join(resolvedPath, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  }

  // 如果需要构建，先执行构建
  if (needsBuild) {
    logger.info('Building project...\n');
    const { spawnAsync } = await import('../utils/spawn.js');
    const buildResult = await spawnAsync(packageManager, ['run', 'build'], {
      cwd: resolvedPath,
      stdio: 'inherit'
    });

    if (buildResult.exitCode !== 0) {
      logger.error('Build failed. Please fix the errors and try again.');
      process.exit(1);
    }
  }

  const tasks: Array<{
    name: string;
    command: string;
    args: string[];
    options: { cwd: string; env: NodeJS.ProcessEnv };
  }> = [];

  // 配置 Service 生产任务
  tasks.push({
    name: 'Service (Backend)',
    command: 'node',
    args: ['dist/main.js'],
    options: {
      cwd: join(resolvedPath, 'service'),
      env: {
        ...process.env,
        PORT: options.port,
        NODE_ENV: 'production'
      }
    }
  });

  // 配置 Renderer 生产任务（使用 preview 模式）
  tasks.push({
    name: 'Renderer (Frontend)',
    command: packageManager,
    args: ['run', 'preview'],
    options: {
      cwd: join(resolvedPath, 'renderer'),
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    }
  });

  logger.info(`Using package manager: ${chalk.cyan(packageManager)}`);
  logger.info(`Project path: ${chalk.cyan(resolvedPath)}`);
  logger.info(`Service port: ${chalk.cyan(options.port)}`);
  logger.newline();
  logger.info('Press Ctrl+C to stop all services\n');

  // 并行启动所有服务
  await runParallel(tasks, (name, exitCode) => {
    if (exitCode !== 0 && exitCode !== null) {
      logger.error(`${name} exited with error code ${exitCode}`);
    }
  });
}
