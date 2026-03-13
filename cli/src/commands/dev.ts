import { resolve, join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { runParallel } from '../utils/spawn.js';

interface DevOptions {
  serviceOnly: boolean;
  rendererOnly: boolean;
  port: string;
}

export async function devCommand(projectPath: string, options: DevOptions): Promise<void> {
  const resolvedPath = resolve(projectPath);

  logger.title('🚀 Starting OpenMCP Development Mode\n');

  // 验证项目结构
  const serviceDir = join(resolvedPath, 'service');
  const rendererDir = join(resolvedPath, 'renderer');
  const packageJsonPath = join(resolvedPath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    logger.error(`No package.json found in ${resolvedPath}`);
    logger.info('Make sure you are in an OpenMCP project directory.');
    logger.info('Run "openmcp-cli init <project-name>" to create a new project.');
    process.exit(1);
  }

  // 检测包管理器
  let packageManager = 'npm';
  if (existsSync(join(resolvedPath, 'yarn.lock'))) {
    packageManager = 'yarn';
  } else if (existsSync(join(resolvedPath, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  }

  const tasks: Array<{
    name: string;
    command: string;
    args: string[];
    options: { cwd: string; env: NodeJS.ProcessEnv };
  }> = [];

  // 配置 Service 任务
  if (!options.rendererOnly) {
    if (!existsSync(serviceDir)) {
      logger.error('Service directory not found. Is this a valid OpenMCP project?');
      process.exit(1);
    }

    tasks.push({
      name: 'Service (Backend)',
      command: packageManager,
      args: ['run', 'serve'],
      options: {
        cwd: serviceDir,
        env: {
          ...process.env,
          PORT: options.port,
          NODE_ENV: 'development'
        }
      }
    });
  }

  // 配置 Renderer 任务
  if (!options.serviceOnly) {
    if (!existsSync(rendererDir)) {
      logger.error('Renderer directory not found. Is this a valid OpenMCP project?');
      process.exit(1);
    }

    tasks.push({
      name: 'Renderer (Frontend)',
      command: packageManager,
      args: ['run', 'serve'],
      options: {
        cwd: rendererDir,
        env: {
          ...process.env,
          NODE_ENV: 'development'
        }
      }
    });
  }

  if (tasks.length === 0) {
    logger.error('No services to start. Use --service-only or --renderer-only flags correctly.');
    process.exit(1);
  }

  logger.info(`Using package manager: ${chalk.cyan(packageManager)}`);
  logger.info(`Project path: ${chalk.cyan(resolvedPath)}`);
  
  if (!options.rendererOnly) {
    logger.info(`Service port: ${chalk.cyan(options.port)}`);
  }

  logger.newline();
  logger.info('Press Ctrl+C to stop all services\n');

  // 并行启动所有服务
  await runParallel(tasks, (name, exitCode) => {
    if (exitCode !== 0 && exitCode !== null) {
      logger.error(`${name} exited with error code ${exitCode}`);
    }
  });
}
