#!/usr/bin/env npx tsx
/**
 * OpenMCP SDK 发布脚本
 * 用法：
 *   npm run publish:sdk         # 构建并发布 SDK
 *   npm run publish:sdk:check   # 仅检查发布准备状态
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SDK_DIR = path.join(ROOT, 'openmcp-sdk');

function log(message: string) {
  console.log(`[publish:sdk] ${message}`);
}

function error(message: string) {
  console.error(`[publish:sdk] ❌ ${message}`);
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

  // 1. 检查 SDK 目录是否存在
  if (!fs.existsSync(SDK_DIR)) {
    error(`SDK 目录不存在: ${SDK_DIR}`);
    hasError = true;
  } else {
    log('✅ SDK 目录存在');
  }

  // 2. 检查 package.json
  const packageJsonPath = path.join(SDK_DIR, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    error('package.json 不存在');
    hasError = true;
  } else {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    log(`✅ package.json 存在，当前版本: ${pkg.version}`);
  }

  // 3. 检查必要文件
  const requiredFiles = ['main.js', 'service/sdk.js', 'task-loop.js'];
  for (const file of requiredFiles) {
    const filePath = path.join(SDK_DIR, file);
    if (!fs.existsSync(filePath)) {
      error(`必要文件缺失: ${file}`);
      hasError = true;
    } else {
      log(`✅ ${file} 存在`);
    }
  }

  // 4. 检查 npm 登录状态
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

  // 预检查
  if (!checkPreflight()) {
    process.exit(1);
  }

  if (checkOnly) {
    log('--check-only: 预检查完成，退出');
    return;
  }

  // 读取当前版本
  const packageJsonPath = path.join(SDK_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = pkg.version;

  log(`\n========== 发布 SDK v${currentVersion} ==========\n`);

  // 发布到 npm
  log('正在发布到 npm...');
  try {
    exec('npm publish', SDK_DIR);
    log('\n✅ SDK 发布成功！');
    log(`   包名: ${pkg.name}`);
    log(`   版本: ${currentVersion}`);
  } catch (err) {
    error('发布失败，请检查错误信息');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
