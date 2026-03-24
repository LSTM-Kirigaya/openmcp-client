import { Command } from 'commander';
import open from 'open';
import { createMessageBridge } from '../lib/message-bridge.js';
import { printJson, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';
import { HELP_CLOUD } from '../lib/help-text.js';

export const cloudCommand = new Command('cloud')
  .description('OpenMCP Cloud 相关能力（当前仅认证登录）。')
  .addHelpText('after', HELP_CLOUD);

const authCommand = new Command('auth')
  .description('认证相关命令');

authCommand
  .command('login')
  .description('账号密码登录（AuthController: auth/login）')
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
  .command('oauth')
  .description('获取 OAuth 授权链接（AuthController: auth/oauth）')
  .argument('<channel>', 'OAuth 渠道，如 github / google')
  .option('-r, --redirect-uri <uri>', '可选回调地址')
  .option('-o, --open', '自动打开浏览器进行 OAuth 认证')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (channel, options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/oauth', {
      channel,
      redirectUri: options.redirectUri
    });

    if (result.code === 200) {
      const authUrl = result.msg?.authUrl || result.msg?.url;
      if (typeof authUrl === 'string') {
        console.log(authUrl);
        if (options.open) {
          try {
            await open(authUrl);
          } catch (error: any) {
            console.error(`❌ 自动打开浏览器失败: ${error?.message || error}`);
            process.exitCode = 1;
          }
        }
      } else {
        printJson(result.msg);
      }
    } else {
      console.error(`❌ OAuth URL 获取失败:`, result.msg);
      process.exitCode = 1;
    }

    await bridge.close();
  });

cloudCommand.addCommand(authCommand);
