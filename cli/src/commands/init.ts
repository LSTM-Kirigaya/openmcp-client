import { resolve, join } from 'path';
import { promises as fs } from 'fs';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { cloneRepository, installDependencies, prepareOCR } from '../utils/download.js';

interface InitOptions {
  template: string;
  force: boolean;
}

export async function initCommand(projectName: string, options: InitOptions): Promise<void> {
  logger.title('🚀 OpenMCP Project Initialization\n');

  const targetDir = resolve(projectName);

  logger.step(1, 4, `Creating project in ${chalk.cyan(targetDir)}`);

  // Step 1: Clone repository
  const cloneSuccess = await cloneRepository(targetDir, { force: options.force });
  if (!cloneSuccess) {
    process.exit(1);
  }

  logger.step(2, 4, 'Installing dependencies');
  const installSuccess = await installDependencies(targetDir);
  if (!installSuccess) {
    logger.warning('Dependency installation failed, but you can retry manually with:');
    logger.info(`  cd ${projectName} && npm install`);
  }

  logger.step(3, 4, 'Preparing resources');
  await prepareOCR(targetDir);

  logger.step(4, 4, 'Finalizing setup');
  
  // 创建 .env 文件（如果需要）
  try {
    const envPath = join(targetDir, '.env');
    const envContent = `# OpenMCP Environment Configuration
NODE_ENV=development
PORT=8282
`;
    await fs.writeFile(envPath, envContent, { flag: 'wx' }).catch(() => {
      // 文件已存在，忽略
    });
  } catch {
    // 忽略错误
  }

  logger.newline();
  logger.success('Project initialized successfully!\n');

  console.log(chalk.bold('Next steps:'));
  console.log(`  ${chalk.cyan('cd')} ${projectName}`);
  console.log(`  ${chalk.cyan('openmcp-cli dev')}     ${chalk.gray('# Start development servers')}`);
  console.log(`  ${chalk.cyan('openmcp-cli start')}   ${chalk.gray('# Start production mode')}`);
  console.log('');

  console.log(chalk.bold('Documentation:'));
  console.log(`  ${chalk.cyan('https://openmcp.kirigaya.cn')}`);
  console.log(`  ${chalk.cyan('https://github.com/LSTM-Kirigaya/openmcp-client')}`);
  console.log('');
}
