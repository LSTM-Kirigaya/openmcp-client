/**
 * 在本地打出 service、gateway、openmcp-cli 三个 .tgz，便于在不发布到 npm 的情况下模拟安装。
 *
 * 用法（仓库根目录）：
 *   node scripts/pack-npm-test.mjs
 *
 * 然后在任意空目录测试（将路径换成你机器上的输出路径）：
 *   mkdir omcp-try && cd omcp-try && npm init -y
 *   npm install ..\path\to\openmcp-service-0.0.1.tgz ..\path\to\openmcp-gateway-0.0.1.tgz ..\path\to\openmcp-cli-0.1.0.tgz
 *   npx openmcp-cli --help
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const steps = [
  { name: '@openmcp/service', dir: 'service' },
  { name: '@openmcp/gateway', dir: 'gateway' },
  { name: 'openmcp-cli', dir: 'cli' }
];

for (const { name, dir } of steps) {
  const cwd = path.join(ROOT, dir);
  console.log(`\n=== build ${name} ===\n`);
  execSync('yarn build', { cwd, stdio: 'inherit', shell: true });
  console.log(`\n=== npm pack ${name} ===\n`);
  execSync('npm pack', { cwd, stdio: 'inherit', shell: true });
}

console.log(`
完成。请在各包目录下找到：
  - openmcp-service-0.0.1.tgz
  - openmcp-gateway-0.0.1.tgz
  - openmcp-cli-0.1.0.tgz

本地试装（一次装三个，npm 会从本地 tarball 满足依赖，不再请求 registry）：

  mkdir omcp-try && cd omcp-try && npm init -y
  npm install <service.tgz 绝对或相对路径> <gateway.tgz> <cli.tgz>
  npx openmcp-cli --help
`);
