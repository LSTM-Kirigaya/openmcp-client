import { Command } from 'commander';
import { parseJsonData, printResponse, withGateway, DEFAULT_GATEWAY } from '../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

const PROJECT_PATCH_KEYS = ['name', 'transport', 'endpoint', 'description', 'enabled'] as const;

function assertPlainObject(v: Record<string, unknown>, label: string): void {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

/** 从 --data 中取出允许写入项目的字段 */
function pickProjectFieldsFromData(data: Record<string, unknown>): Record<string, unknown> {
  assertPlainObject(data, '--data');
  const o: Record<string, unknown> = {};
  for (const k of PROJECT_PATCH_KEYS) {
    if (k in data && data[k] !== undefined) o[k] = data[k];
  }
  return o;
}

function parseEnabledFlag(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const v = String(raw).toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  throw new Error('--enabled 须为 true 或 false');
}

const DATA_HELP_CREATE_UPDATE =
  '支持两种方式，可混用：① 分项参数（--name、--transport 等）；② --data 传入一整段 JSON 对象。' +
  '若同时使用，分项参数覆盖 --data 中同名字段。';

export const projectsCmd = new Command('projects')
  .description(
    '项目（Project/Member/Invite）云端能力。其中 create / update：' + DATA_HELP_CREATE_UPDATE
  )
  .addHelpText(
    'after',
    '\n说明：create、update 除分项 flag 外，可用 --data \'{"transport":"sse"}\' 一次传入多个字段（PowerShell 注意引号转义）。\n'
  );

const projectsCreate = projectsCmd
  .command('create')
  .description('创建项目（projects/create）。' + DATA_HELP_CREATE_UPDATE)
  .requiredOption('--name <name>', '项目名称')
  .option('--transport <t>', 'stdio | sse | http')
  .option('--endpoint <url>', 'MCP 连接地址')
  .option('--description <text>', '描述')
  .option('--enabled <bool>', 'true 或 false')
  .option(
    '--data <json>',
    'JSON 对象字符串，可含 name、transport、endpoint、description、enabled；与分项参数合并，同名字段以 flag 为准'
  )
  .action(async (options) => {
    await withGateway(options.gateway, async (bridge) => {
      const fromData = pickProjectFieldsFromData(parseJsonData(options.data));
      const enabled = parseEnabledFlag(options.enabled);
      const transport = options.transport ?? (fromData.transport as string | undefined) ?? 'http';
      const endpoint =
        options.endpoint ?? (fromData.endpoint as string | undefined) ?? 'http://127.0.0.1:0';
      const req: Record<string, unknown> = {
        ...fromData,
        name: options.name,
        transport,
        endpoint
      };
      if (options.description !== undefined) req.description = options.description;
      if (enabled !== undefined) req.enabled = enabled;
      const res = await bridge.commandRequest('projects/create', req);
      printResponse('projects/create', res);
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
        printResponse('projects/list', res);
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
        printResponse('projects/get', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  projectsCmd
    .command('update')
    .description(
      '更新项目（projects/update）。' +
        DATA_HELP_CREATE_UPDATE +
        '可不传入全部字段，仅修改传入的字段。'
    )
    .requiredOption('--project-id <id>', '项目 ID（路径参数，不可放进 --data）')
    .option('--name <name>', '项目名称')
    .option('--transport <t>', 'stdio | sse | http')
    .option('--endpoint <url>', 'MCP 连接地址')
    .option('--description <text>', '描述')
    .option('--enabled <bool>', 'true 或 false')
    .option(
      '--data <json>',
      'JSON 对象字符串，可含 name、transport、endpoint、description、enabled；与分项参数合并，同名字段以 flag 为准'
    )
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const fromData = pickProjectFieldsFromData(parseJsonData(options.data));
        const body: Record<string, unknown> = { ...fromData };
        if (options.name !== undefined) body.name = options.name;
        if (options.transport !== undefined) body.transport = options.transport;
        if (options.endpoint !== undefined) body.endpoint = options.endpoint;
        if (options.description !== undefined) body.description = options.description;
        const en = parseEnabledFlag(options.enabled);
        if (en !== undefined) body.enabled = en;
        const res = await bridge.commandRequest('projects/update', {
          projectId: options.projectId,
          ...body
        });
        printResponse('projects/update', res);
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
        printResponse('projects/delete', res);
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
        printResponse('projects/members/list', res);
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
        printResponse('projects/members/add', res);
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
        printResponse('projects/members/remove', res);
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
        printResponse('projects/members/update-role', res);
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
        printResponse('projects/invites/list', res);
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
        printResponse('projects/invites/create', res);
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
        printResponse('projects/invites/delete', res);
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
        printResponse('projects/invites/revoke', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

