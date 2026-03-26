import { Command } from 'commander';
import open from 'open';
import http from 'node:http';
import { URL } from 'node:url';
import { createMessageBridge } from '../lib/message-bridge.js';
import { printJson, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';
import { HELP_CLOUD } from '../lib/help-text.js';
import { projectsCmd } from './cloud-projects.js';
import { specCasesCmd } from './cloud-spec-cases.js';
import { invitesCmd } from './cloud-invites.js';

export const cloudCommand = new Command('cloud')
  .description('OpenMCP Cloud 相关能力（认证 + 项目/成员/邀请/SpecCase）。')
  .addHelpText('after', HELP_CLOUD);

const authCommand = new Command('auth')
  .description('认证相关命令');

authCommand
  .command('register')
  .description('注册账号（AuthController: auth/register）')
  .requiredOption('--email <email>', '邮箱')
  .requiredOption('-u, --username <username>', '用户名')
  .requiredOption('-p, --password <password>', '密码')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/register', {
      email: options.email,
      username: options.username,
      password: options.password
    });
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

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
  .command('logout')
  .description('登出当前会话（AuthController: auth/logout）')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/logout', {});
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

authCommand
  .command('logout-all')
  .description('登出所有会话（AuthController: auth/logout-all）')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/logout-all', {});
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

authCommand
  .command('status')
  .description('查看当前登录状态（AuthController: auth/status）')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/status', {});
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

authCommand
  .command('refresh')
  .description('刷新 token（AuthController: auth/refresh）')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/refresh', {});
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

authCommand
  .command('set-token')
  .description('手动设置 access token（AuthController: auth/set-token）')
  .requiredOption('--token <token>', 'token 字符串')
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
  .description('查看当前 token（AuthController: auth/get-token）')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/get-token', {});
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

authCommand
  .command('clear-token')
  .description('清除本地 token（AuthController: auth/clear-token）')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (options) => {
    const bridge = await createMessageBridge(options.gateway);
    const result = await bridge.commandRequest('auth/clear-token', {});
    printJson(result);
    if (result.code !== 200) process.exitCode = 1;
    await bridge.close();
  });

authCommand
  .command('oauth')
  .description('获取 OAuth 授权链接（AuthController: auth/oauth）')
  .argument('<channel>', 'OAuth 渠道，如 github / google')
  .option('-r, --redirect-uri <uri>', '可选回调地址')
  .option('--auto-store', '自动接收 nonce 并把 token 写入本地（需要后端支持 oauth/tokens）', true)
  .option('-o, --open', '自动打开浏览器进行 OAuth 认证')
  .option('-g, --gateway <url>', 'Gateway URL', DEFAULT_GATEWAY)
  .action(async (channel, options) => {
    const bridge = await createMessageBridge(options.gateway);
    const autoStore: boolean = options.autoStore ?? true;
    const redirectUriFromCli: string | undefined = options.redirectUri;

    let callbackUrl: string | undefined = redirectUriFromCli;

    // 自动保存模式：如果用户没指定 redirectUri，就启动本地回调页，让后端 302 跳转回来
    let server: http.Server | null = null;
    let finalizeDone: Promise<any> | null = null;
    let finalizeDoneResolve: ((v: any) => void) | null = null;
    let finalizeDoneReject: ((e: any) => void) | null = null;

    if (autoStore && !redirectUriFromCli) {
      finalizeDone = new Promise((resolve, reject) => {
        finalizeDoneResolve = resolve;
        finalizeDoneReject = reject;
      });

      callbackUrl = await new Promise<string>((resolve, reject) => {
        const srv = http.createServer((req, res) => {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');

          const reqUrl = req.url ? new URL(req.url, 'http://127.0.0.1') : null;
          const pathname = reqUrl?.pathname || '';
          if (req.method !== 'GET' || pathname !== '/oauth-callback') {
            res.statusCode = 404;
            res.end('Not Found');
            return;
          }

          const nonce = reqUrl?.searchParams.get('nonce') || '';
          if (!nonce) {
            res.statusCode = 400;
            res.end('Missing nonce in callback URL');
            return;
          }

          // 获取 nonce 对应的 tokens，然后通知 service 写入 token-store（并落盘）
          void bridge
            .commandRequest('auth/oauth/finalize', { nonce })
            .then((finalizeResult) => {
              res.statusCode = 200;
              res.end(
                `<html><body><h3>OAuth 登录成功</h3><p>你可以回到终端继续操作。</p></body></html>`
              );
              finalizeDoneResolve?.(finalizeResult);
            })
            .catch((e) => {
              res.statusCode = 500;
              res.end(
                `<html><body><h3>OAuth 登录失败</h3><pre>${String(e?.message || e)}</pre></body></html>`
              );
              finalizeDoneReject?.(e);
            });
        });

        server = srv;
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
          const addr = srv.address();
          const port = typeof addr === 'object' && addr ? addr.port : null;
          if (!port) return reject(new Error('Failed to get local callback port'));
          resolve(`http://127.0.0.1:${port}/oauth-callback`);
        });
      });
    }

    const result = await bridge.commandRequest('auth/oauth', {
      channel,
      redirectUri: callbackUrl
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

        if (server && finalizeDone) {
          console.log(`🔄 等待 OAuth 完成并自动保存 token...`);
          const timeoutAt = Date.now() + 5 * 60 * 1000;
          try {
            await Promise.race([
              finalizeDone,
              new Promise((r) => {
                const ms = Math.max(0, timeoutAt - Date.now());
                setTimeout(() => r(null), ms);
              })
            ]);
          } catch (e: any) {
            console.error(`❌ OAuth finalize 失败: ${e?.message || e}`);
            process.exitCode = 1;
          }
          await new Promise<void>((r) => server?.close(() => r()));
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
cloudCommand.addCommand(projectsCmd);
cloudCommand.addCommand(specCasesCmd);
cloudCommand.addCommand(invitesCmd);
