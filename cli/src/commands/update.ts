import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import ora from 'ora';

interface UpdateOptions {
  check: boolean;
}

const REPO_URL = 'https://github.com/LSTM-Kirigaya/openmcp-client.git';

async function getLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    // 使用 git ls-remote 获取最新的 tag
    const gitProcess = spawn('git', ['ls-remote', '--tags', '--refs', '--sort=-v:refname', REPO_URL], {
      stdio: 'pipe'
    });

    let stdout = '';
    gitProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    gitProcess.on('close', (code) => {
      if (code === 0 && stdout) {
        // 解析最新的 tag
        const lines = stdout.trim().split('\n');
        if (lines.length > 0) {
          const latestTag = lines[0].split('/').pop();
          resolve(latestTag || null);
        } else {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    gitProcess.on('error', () => {
      resolve(null);
    });
  });
}

function getCurrentVersion(projectPath: string): string | null {
  try {
    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      return pkg.version || null;
    }
  } catch {
    // 忽略错误
  }
  return null;
}

export async function updateCommand(projectPath: string, options: UpdateOptions): Promise<void> {
  const resolvedPath = resolve(projectPath);

  logger.title('🔄 OpenMCP Update Check\n');

  // 验证项目
  const packageJsonPath = join(resolvedPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    logger.error(`No package.json found in ${resolvedPath}`);
    logger.info('Make sure you are in an OpenMCP project directory.');
    process.exit(1);
  }

  const spinner = ora('Checking for updates...').start();
  const currentVersion = getCurrentVersion(resolvedPath);
  const latestVersion = await getLatestVersion();

  if (!latestVersion) {
    spinner.fail('Failed to check for updates');
    logger.info('Make sure you have internet connection and git installed.');
    process.exit(1);
  }

  spinner.succeed('Update check completed');

  logger.info(`Current version: ${currentVersion ? chalk.cyan(currentVersion) : chalk.gray('unknown')}`);
  logger.info(`Latest version:  ${chalk.cyan(latestVersion)}`);

  if (options.check) {
    // 只检查，不更新
    if (currentVersion && currentVersion === latestVersion) {
      logger.success('\nYou are already on the latest version!');
    } else {
      logger.warning('\nA new version is available!');
      logger.info(`Run "openmcp-cli update" to update.`);
    }
    return;
  }

  // 执行更新
  if (currentVersion === latestVersion) {
    logger.success('\nAlready up to date!');
    return;
  }

  logger.newline();
  logger.info('Updating project...\n');

  // 使用 git 更新
  const updateResult = await new Promise<boolean>((resolve) => {
    // 先获取远程更新
    const fetchProcess = spawn('git', ['fetch', '--all'], {
      cwd: resolvedPath,
      stdio: 'pipe'
    });

    fetchProcess.on('close', (fetchCode) => {
      if (fetchCode !== 0) {
        logger.warning('Failed to fetch updates. Trying alternative method...');
        resolve(false);
        return;
      }

      // 然后重置到最新版本
      const resetProcess = spawn('git', ['reset', '--hard', `origin/${latestVersion}`], {
        cwd: resolvedPath,
        stdio: 'inherit'
      });

      resetProcess.on('close', (resetCode) => {
        resolve(resetCode === 0);
      });
    });
  });

  if (!updateResult) {
    logger.error('Failed to update project automatically.');
    logger.info('You can manually update by:');
    logger.info('  1. Backup your data');
    logger.info('  2. Delete the project directory');
    logger.info('  3. Run "openmcp-cli init" to create a fresh project');
    process.exit(1);
  }

  logger.success('\nProject updated successfully!');
  logger.info('You may need to reinstall dependencies:');
  logger.info(`  cd ${projectPath} && npm install`);
}
