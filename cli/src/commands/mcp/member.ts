import { Command } from 'commander';
import { DEFAULT_GATEWAY, printResponse, withGateway } from '../../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const mcpMemberCommand = new Command('member')
  .description('云端项目成员管理')
  .addHelpText('after', `
示例:
  列出成员:        openmcp-cli mcp server member list --project-id <ID>
  添加成员:        openmcp-cli mcp server member add --project-id <ID> --user-id <UID> --role writer
  移除成员:        openmcp-cli mcp server member remove --project-id <ID> --user-id <UID>
  更新角色:        openmcp-cli mcp server member update-role --project-id <ID> --user-id <UID> --role owner
`);

gw(
  mcpMemberCommand
    .command('list')
    .description('列出云端项目成员')
    .requiredOption('--project-id <id>', '项目 ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/members/list', { projectId: options.projectId });
        printResponse('projects/members/list', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpMemberCommand
    .command('add')
    .description('添加成员')
    .requiredOption('--project-id <id>', '项目 ID')
    .requiredOption('--user-id <id>', '用户 ID')
    .requiredOption('--role <role>', '角色（writer）')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/members/add', {
          projectId: options.projectId,
          userId: options.userId,
          role: options.role
        });
        printResponse('projects/members/add', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpMemberCommand
    .command('remove')
    .description('移除成员')
    .requiredOption('--project-id <id>', '项目 ID')
    .requiredOption('--user-id <id>', '用户 ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/members/remove', {
          projectId: options.projectId,
          userId: options.userId
        });
        printResponse('projects/members/remove', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  mcpMemberCommand
    .command('update-role')
    .description('更新成员角色')
    .requiredOption('--project-id <id>', '项目 ID')
    .requiredOption('--user-id <id>', '用户 ID')
    .requiredOption('--role <role>', '角色（writer | owner）')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/members/update-role', {
          projectId: options.projectId,
          userId: options.userId,
          role: options.role
        });
        printResponse('projects/members/update-role', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
