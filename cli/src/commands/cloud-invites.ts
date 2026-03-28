import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const invitesCmd = new Command('invites')
  .description('邀请（invites/join）云端能力');

gw(
  invitesCmd
    .command('join')
    .description('使用邀请码加入项目（invites/join）')
    .requiredOption('--code <code>', '邀请码')
    .requiredOption('--user-id <id>', '要加入的用户ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('invites/join', { code: options.code, userId: options.userId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

