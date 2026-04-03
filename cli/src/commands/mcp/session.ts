import { Command } from 'commander';
import {
  DEFAULT_GATEWAY,
  printJson,
  printResponse,
  withGateway
} from '../../lib/cli-helpers.js';
import {
  getCurrentClientId,
  getRecentSessions,
  getSessionStorePath,
  rememberSession,
  removeSession,
  requireClientId,
  setCurrentClientId
} from '../../lib/mcp-session-store.js';
import { diagnoseThrownError } from '../../lib/error-diagnose.js';

type ConnectPayload = Record<string, unknown>;
type CloudProjectTransport = 'stdio' | 'sse' | 'http';

type CloudProjectItem = {
  id: string;
  name: string;
  transport: CloudProjectTransport;
  endpoint: string;
  description?: string;
  enabled?: boolean;
};

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function printThrown(error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  console.error(text);
  for (const tip of diagnoseThrownError(error)) {
    console.error(`[diagnose] ${tip}`);
  }
  process.exitCode = 1;
}

function rememberConnectedSessions(
  gateway: string,
  response: { data?: unknown }
): void {
  const payload = response.data as {
    connection?: { item?: unknown };
    results?: Array<{ code?: number; msg?: { clientId?: string } }>;
  } | undefined;
  const entries = Array.isArray(payload?.connection?.item)
    ? payload?.connection?.item
    : payload?.connection?.item
      ? [payload.connection.item]
      : [];
  for (const [index, result] of (payload?.results || []).entries()) {
    const clientId = result?.msg?.clientId;
    if (result?.code === 200 && typeof clientId === 'string') {
      const entry = (entries[index] ?? entries[0] ?? {}) as Record<string, unknown>;
      rememberSession(clientId, gateway, entry);
    }
  }
}

function toCloudProjectList(response: { data?: unknown; msg?: unknown }): CloudProjectItem[] {
  const raw = (response.data ?? response.msg) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is CloudProjectItem => {
    return (
      typeof item === 'object' && item !== null &&
      typeof (item as any).id === 'string' &&
      typeof (item as any).name === 'string' &&
      typeof (item as any).transport === 'string' &&
      typeof (item as any).endpoint === 'string'
    );
  });
}

function mapCloudTransportToConnectionType(transport: CloudProjectTransport): 'STDIO' | 'SSE' | 'STREAMABLE_HTTP' {
  if (transport === 'stdio') return 'STDIO';
  if (transport === 'sse') return 'SSE';
  return 'STREAMABLE_HTTP';
}

function buildPayloadFromCloudProject(project: CloudProjectItem): ConnectPayload {
  const connectionType = mapCloudTransportToConnectionType(project.transport);
  if (connectionType === 'STDIO') {
    return { connectionType, command: project.endpoint };
  }
  return { connectionType, url: project.endpoint };
}

export const mcpSessionCommand = new Command('session')
  .description('MCP 会话管理（运行时连接的建立、断开与切换）')
  .addHelpText('after', `
示例:
  列出活跃会话:         openmcp-cli mcp session list
  连接指定 Server:      openmcp-cli mcp session connect --id <SERVER_ID>
  断开连接:             openmcp-cli mcp session disconnect
  查看当前默认会话:     openmcp-cli mcp session current
  切换默认会话:         openmcp-cli mcp session use --client-id <ID>
  云端快捷连接:         openmcp-cli mcp session cloud-connect --name <项目名>
`);

/* ── list ── */

gw(
  mcpSessionCommand
    .command('list')
    .description('列出 Gateway 中当前活跃的 MCP 会话')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('connect/list', {});
          printResponse('connect/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

/* ── current ── */

mcpSessionCommand
  .command('current')
  .description('查看当前默认会话')
  .action(() => {
    printJson({
      currentClientId: getCurrentClientId() ?? null,
      storePath: getSessionStorePath()
    });
  });

/* ── recent ── */

mcpSessionCommand
  .command('recent')
  .description('查看最近连接记录')
  .option('--limit <n>', '数量，默认 20', '20')
  .action((options) => {
    const limit = Number(options.limit || 20);
    printJson({
      currentClientId: getCurrentClientId() ?? null,
      recent: getRecentSessions(limit),
      storePath: getSessionStorePath()
    });
  });

/* ── use ── */

mcpSessionCommand
  .command('use')
  .description('切换默认会话')
  .requiredOption('--client-id <id>', '目标 clientId')
  .action((options) => {
    setCurrentClientId(options.clientId);
    printJson({ ok: true, currentClientId: options.clientId });
  });

/* ── connect ── */

gw(
  mcpSessionCommand
    .command('connect')
    .description('用已保存的 MCP Server 建立会话')
    .requiredOption('--id <id>', 'Server ID（使用 "mcp server list" 查看）')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const getRes = await bridge.commandRequest('servers/get', { id: options.id });
          if (getRes.code !== 200) {
            console.error(`未找到 Server: ${options.id}`);
            console.error('使用 "openmcp-cli mcp server list" 查看可用的 Server');
            process.exitCode = 1;
            return;
          }
          const server = getRes.data as Record<string, unknown>;
          const name = (server.name as string) || options.id;
          console.log(`正在连接: ${name} ...`);

          const res = await bridge.commandRequest('connect', server, 120000);
          printResponse('connect', res);
          const clientId = (res.msg as any)?.clientId ?? (res.data as any)?.clientId;
          if (res.code === 200 && typeof clientId === 'string') {
            rememberSession(clientId, options.gateway, server);
            console.log(`\n✔ 已连接，clientId: ${clientId}`);
          }
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── disconnect ── */

gw(
  mcpSessionCommand
    .command('disconnect')
    .description('断开当前活跃的 MCP 会话')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .action(async (options) => {
      try {
        const clientId = requireClientId(options.clientId);
        rememberSession(clientId, options.gateway);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('disconnect', { clientId });
          printResponse('disconnect', res);
          if (res.code === 200) removeSession(clientId);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

/* ── cloud-connect ── */

gw(
  mcpSessionCommand
    .command('cloud-connect')
    .description('通过云端项目快捷连接')
    .option('--project-id <id>', '云端项目 ID')
    .option('--name <name>', '云端项目名（与 --project-id 二选一）')
    .option('--allow-disabled', '允许连接 disabled 项目', false)
    .action(async function (this: Command, options) {
      try {
        if (!options.projectId && !options.name) {
          this.help({ error: true });
          return;
        }

        await withGateway(options.gateway, async (bridge) => {
          const listRes = await bridge.commandRequest('projects/list', {});
          if (listRes.code !== 200) {
            printResponse('projects/list', listRes);
            process.exitCode = 1;
            return;
          }
          const projects = toCloudProjectList(listRes);
          const project = projects.find((item) => {
            if (!options.allowDisabled && item.enabled === false) return false;
            if (options.projectId) return item.id === options.projectId;
            return item.name === options.name;
          });
          if (!project) {
            throw new Error('未找到匹配的云端项目（或项目已被禁用）');
          }

          const payload = buildPayloadFromCloudProject(project);
          const connectRes = await bridge.commandRequest('connect', payload, 120000);
          printResponse('connect', connectRes);
          const clientId = (connectRes.msg as any)?.clientId ?? (connectRes.data as any)?.clientId;
          if (connectRes.code === 200 && typeof clientId === 'string') {
            rememberSession(clientId, options.gateway, payload);
          }
          if (connectRes.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
