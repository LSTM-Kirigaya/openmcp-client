import { Command } from 'commander';
import { DEFAULT_GATEWAY, printJson, printResponse, withGateway } from '../../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const mcpInviteCommand = new Command('invite')
  .description('云端项目邀请管理')
  .addHelpText('after', `
示例:
  创建邀请:        openmcp-cli mcp server invite create --project-id <ID> --role writer
  使用邀请码加入:   openmcp-cli mcp server invite join --code <CODE> --user-id <UID>
  列出邀请:        openmcp-cli mcp server invite list --project-id <ID>
  删除邀请:        openmcp-cli mcp server invite delete --project-id <ID> --invite-id <IID>
  撤销邀请:        openmcp-cli mcp server invite revoke --project-id <ID> --invite-id <IID>
`);

gw(
  mcpInviteCommand
    .command('create')
    .description('创建邀请')
    .requiredOption('--project-id <id>', '项目 ID')
    .requiredOption('--role <role>', '角色（writer | owner）')
    .option('--expires-at <iso>', '过期时间（ISO8601）')
    .option('--max-uses <n>', '最大使用次数')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/invites/create', {
          projectId: options.projectId,
          role: options.role,
          expiresAt: options.expiresAt,
          maxUses: options.maxUses ? Number(options.maxUses) : undefined
        });
        printResponse('projects/invites/create', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpInviteCommand
    .command('join')
    .description('使用邀请码加入项目')
    .requiredOption('--code <code>', '邀请码')
    .requiredOption('--user-id <id>', '要加入的用户 ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('invites/join', { code: options.code, userId: options.userId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpInviteCommand
    .command('list')
    .description('列出邀请')
    .requiredOption('--project-id <id>', '项目 ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/invites/list', { projectId: options.projectId });
        printResponse('projects/invites/list', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpInviteCommand
    .command('delete')
    .description('删除邀请')
    .requiredOption('--project-id <id>', '项目 ID')
    .requiredOption('--invite-id <id>', '邀请 ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/invites/delete', {
          projectId: options.projectId,
          inviteId: options.inviteId
        });
        printResponse('projects/invites/delete', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpInviteCommand
    .command('revoke')
    .description('撤销邀请')
    .requiredOption('--project-id <id>', '项目 ID')
    .requiredOption('--invite-id <id>', '邀请 ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/invites/revoke', {
          projectId: options.projectId,
          inviteId: options.inviteId
        });
        printResponse('projects/invites/revoke', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
