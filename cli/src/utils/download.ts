import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { logger } from './logger.js';
import ora from 'ora';

const REPO_URL = 'https://github.com/LSTM-Kirigaya/openmcp-client.git';

export async function cloneRepository(
  targetDir: string,
  options: {
    force?: boolean;
    branch?: string;
  } = {}
): Promise<boolean> {
  const { force = false, branch = 'main' } = options;

  try {
    // 检查目标目录是否存在
    try {
      await fs.access(targetDir);
      if (!force) {
        logger.error(`Directory "${targetDir}" already exists. Use --force to overwrite.`);
        return false;
      }
      logger.warning(`Directory "${targetDir}" exists, removing...`);
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch {
      // 目录不存在，继续
    }

    const spinner = ora('Cloning OpenMCP repository...').start();

    // 使用 git clone
    const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      const args = ['clone', '--depth', '1', '--branch', branch, REPO_URL, targetDir];
      const gitProcess = spawn('git', args, {
        stdio: 'pipe'
      });

      let stderr = '';
      gitProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderr || `Git exited with code ${code}` });
        }
      });

      gitProcess.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });

    if (!result.success) {
      spinner.fail('Failed to clone repository');
      logger.error(result.error || 'Unknown error');
      return false;
    }

    spinner.succeed('Repository cloned successfully');

    // 移除 .git 目录以减少大小
    try {
      const gitDir = join(targetDir, '.git');
      await fs.rm(gitDir, { recursive: true, force: true });
    } catch {
      // 忽略错误
    }

    return true;
  } catch (error) {
    logger.error(`Failed to clone repository: ${error}`);
    return false;
  }
}

export async function installDependencies(projectPath: string): Promise<boolean> {
  const spinner = ora('Installing dependencies (this may take a few minutes)...').start();

  // 检测包管理器
  let packageManager = 'npm';
  try {
    await fs.access(join(projectPath, 'yarn.lock'));
    packageManager = 'yarn';
  } catch {
    try {
      await fs.access(join(projectPath, 'pnpm-lock.yaml'));
      packageManager = 'pnpm';
    } catch {
      // 使用 npm
    }
  }

  const result = await new Promise<boolean>((resolve) => {
    const installProcess = spawn(packageManager, ['install'], {
      cwd: projectPath,
      stdio: 'pipe',
      shell: true
    });

    let stderr = '';
    installProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    installProcess.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        spinner.fail('Failed to install dependencies');
        logger.error(stderr || `Install exited with code ${code}`);
        resolve(false);
      }
    });

    installProcess.on('error', (err) => {
      spinner.fail('Failed to run install command');
      logger.error(err.message);
      resolve(false);
    });
  });

  if (result) {
    spinner.succeed(`Dependencies installed with ${packageManager}`);
  }

  return result;
}

export async function prepareOCR(projectPath: string): Promise<boolean> {
  const spinner = ora('Preparing OCR resources...').start();

  const result = await new Promise<boolean>((resolve) => {
    const prepareProcess = spawn('npm', ['run', 'prepare:ocr'], {
      cwd: projectPath,
      stdio: 'pipe',
      shell: true
    });

    let stderr = '';
    prepareProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    prepareProcess.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        spinner.fail('Failed to prepare OCR resources');
        logger.warning(stderr || 'OCR prepare exited with non-zero code, but this is optional');
        resolve(true); // OCR 失败不是致命的
      }
    });

    prepareProcess.on('error', () => {
      // OCR 准备失败不是致命的
      resolve(true);
    });
  });

  if (result) {
    spinner.succeed('OCR resources prepared');
  }

  return result;
}
