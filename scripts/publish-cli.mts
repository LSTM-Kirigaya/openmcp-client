#!/usr/bin/env npx tsx
/**
 * OpenMCP CLI 发布脚本
 * 用法：
 *   npm run publish:cli         # 构建并发布 CLI
 *   npm run publish:cli:check   # 仅检查发布准备状态
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLI_DIR = path.join(ROOT, 'cli');

function log(message: string) {
  console.log(`[publish:cli] ${message}`);
}

function error(message: string) {
  console.error(`[publish:cli] ❌ ${message}`);
  process.exit(1);
}

function exec(command: string, cwd: string = ROOT): string {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: 'inherit'
    });
  } catch (err) {
    throw new Error(`命令执行失败: ${command}`);
  }
}

function checkPreflight(): boolean {
  log('\n========== 发布前检查 ==========\n');

  let hasError = false;

  // 1. 检查 CLI 目录是否存在
  if (!fs.existsSync(CLI_DIR)) {
    error(`CLI 目录不存在: ${CLI_DIR}`);
    hasError = true;
  } else {
    log('✅ CLI 目录存在');
  }

  // 2. 检查 package.json
  const packageJsonPath = path.join(CLI_DIR, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    error('package.json 不存在');
    hasError = true;
  } else {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    log(`✅ package.json 存在，当前版本: ${pkg.version}`);
  }

  // 3. 检查 npm 登录状态
  try {
    execSync('npm whoami', { encoding: 'utf-8' });
    log('✅ 已登录 npm');
  } catch {
    error('未登录 npm，请先执行: npm login');
    hasError = true;
  }

  if (hasError) {
    return false;
  }

  log('\n✅ 预检查通过\n');
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check-only');
  const skipBuild = args.includes('--skip-build');

  // 预检查
  if (!checkPreflight()) {
    process.exit(1);
  }

  if (checkOnly) {
    log('--check-only: 预检查完成，退出');
    return;
  }

  // 读取当前版本
  const packageJsonPath = path.join(CLI_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = pkg.version;

  log(`\n========== 发布 CLI v${currentVersion} ==========\n`);

  // 安装依赖
  if (!skipBuild) {
    log('Step 1/3: 安装依赖...');
    exec('npm install', CLI_DIR);

    // 构建
    log('\nStep 2/3: 构建 TypeScript...');
    exec('npm run build', CLI_DIR);

    // 设置可执行权限
    log('\nStep 3/3: 设置可执行权限...');
    try {
      const binPath = path.join(CLI_DIR, 'bin', 'openmcp');
      fs.chmodSync(binPath, 0o755);
      log('  ✓ bin/openmcp 已设为可执行');
    } catch {
      log('  ⚠ 警告: 无法设置可执行权限');
    }
  } else {
    log('--skip-build: 跳过构建步骤');
  }

  // 验证构建输出
  const distPath = path.join(CLI_DIR, 'dist', 'index.js');
  if (!fs.existsSync(distPath)) {
    error('构建输出不存在，请先构建: npm run build:cli');
  }

  // 发布到 npm
  log('\n正在发布到 npm...');
  try {
    exec('npm publish', CLI_DIR);
    log('\n✅ CLI 发布成功！');
    log(`   包名: ${pkg.name}`);
    log(`   版本: ${currentVersion}`);
    log(`   安装命令: npm install -g ${pkg.name}`);
  } catch (err) {
    error('发布失败，请检查错误信息');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
