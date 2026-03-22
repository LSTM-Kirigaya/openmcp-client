import { Command } from 'commander';
import { createMessageBridge } from '../lib/message-bridge.js';
import { printJson, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';
import { HELP_AUTH } from '../lib/help-text.js';

export const authCommand = new Command('auth')
  .description('认证与本地 Token（AuthController），多数子命令需 Gateway 已启动。')
  .addHelpText('after', HELP_AUTH);

authCommand
  .command('login')
  .description('登录 OpenMCP')
  .requiredOption('-u, --username <username>', '用户名')
  .requiredOption('-p, --password <password>', '密码')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    console.log(`🔐 Logging in as ${options.username}...`);

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/login', {
      username: options.username,
      password: options.password
    });

    if (result.code === 200) {
      console.log(`✅ Login successful!`);
      printJson(result.msg);
    } else {
      console.error(`❌ Login failed:`, result.msg);
      process.exitCode = 1;
    }

    await bridge.close();
  });

authCommand
  .command('logout')
  .description('登出')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    console.log(`🔐 Logging out...`);

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/logout');

    if (result.code === 200) {
      console.log(`✅ Logged out successfully!`);
    } else {
      console.error(`❌ Logout failed: ${result.msg}`);
      process.exitCode = 1;
    }

    await bridge.close();
  });

authCommand
  .command('status')
  .description('查看登录状态')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    console.log(`🔍 Checking auth status...`);

    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/status');

    if (result.code === 200) {
      printJson(result.msg);
    } else {
      console.error(`❌ Failed to check status: ${result.msg}`);
      process.exitCode = 1;
    }

    await bridge.close();
  });

authCommand
  .command('refresh')
  .description('刷新 Token')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/refresh');
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

authCommand
  .command('set-token')
  .description('手动设置 Token（auth/set-token）')
  .requiredOption('-t, --token <token>', 'Token 字符串')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/set-token', { token: options.token });
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

authCommand
  .command('get-token')
  .description('查看本地 Token 摘要（auth/get-token）')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/get-token');
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

authCommand
  .command('clear-token')
  .description('清除本地 Token（auth/clear-token）')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/clear-token');
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });
