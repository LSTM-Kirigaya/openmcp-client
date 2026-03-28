import { Command } from 'commander';
import { printJson, withGateway, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

export const projectsCmd = new Command('projects')
  .description('项目（Project/Member/Invite）云端能力');

const projectsCreate = projectsCmd
  .command('create')
  .description('创建项目（projects/create）')
  .requiredOption('--name <name>', '项目名称')
  .action(async (options) => {
    await withGateway(options.gateway, async (bridge) => {
      const res = await bridge.commandRequest('projects/create', { name: options.name });
      printJson(res);
      if (res.code !== 200) process.exitCode = 1;
    });
  });
gw(projectsCreate);

gw(
  projectsCmd
    .command('list')
    .description('列出项目（projects/list）')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/list', {});
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  projectsCmd
    .command('get')
    .description('获取项目（projects/get）')
    .requiredOption('--project-id <id>', '项目ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/get', { projectId: options.projectId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  projectsCmd
    .command('update')
    .description('更新项目（projects/update）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--name <name>', '新名称')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/update', { projectId: options.projectId, name: options.name });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  projectsCmd
    .command('delete')
    .description('删除项目（projects/delete）')
    .requiredOption('--project-id <id>', '项目ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/delete', { projectId: options.projectId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

// ---- members ----
const membersCmd = projectsCmd.command('members').description('项目成员（projects/members/*）');
gw(
  membersCmd
    .command('list')
    .description('列出成员（projects/members/list）')
    .requiredOption('--project-id <id>', '项目ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/members/list', { projectId: options.projectId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  membersCmd
    .command('add')
    .description('添加成员（projects/members/add）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--user-id <id>', '用户ID')
    .requiredOption('--role <role>', '角色（writer）')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/members/add', {
          projectId: options.projectId,
          userId: options.userId,
          role: options.role
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  membersCmd
    .command('remove')
    .description('移除成员（projects/members/remove）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--user-id <id>', '用户ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/members/remove', {
          projectId: options.projectId,
          userId: options.userId
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  membersCmd
    .command('update-role')
    .description('更新成员角色（projects/members/update-role）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--user-id <id>', '用户ID')
    .requiredOption('--role <role>', '角色（writer|owner）')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/members/update-role', {
          projectId: options.projectId,
          userId: options.userId,
          role: options.role
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

// ---- invites (project scoped) ----
const invitesCmd = projectsCmd.command('invites').description('项目邀请（projects/invites/*）');
gw(
  invitesCmd
    .command('list')
    .description('列出邀请（projects/invites/list）')
    .requiredOption('--project-id <id>', '项目ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/invites/list', { projectId: options.projectId });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  invitesCmd
    .command('create')
    .description('创建邀请（projects/invites/create）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--role <role>', '角色（writer|owner）')
    .option('--expires-at <iso>', '过期时间（ISO8601 可选）')
    .option('--max-uses <n>', '最大使用次数（number 可选）')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/invites/create', {
          projectId: options.projectId,
          role: options.role,
          expiresAt: options.expiresAt,
          maxUses: options.maxUses ? Number(options.maxUses) : undefined
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  invitesCmd
    .command('delete')
    .description('删除邀请（projects/invites/delete）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--invite-id <id>', '邀请ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/invites/delete', {
          projectId: options.projectId,
          inviteId: options.inviteId
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  invitesCmd
    .command('revoke')
    .description('撤销邀请（projects/invites/revoke）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--invite-id <id>', '邀请ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('projects/invites/revoke', {
          projectId: options.projectId,
          inviteId: options.inviteId
        });
        printJson(res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

