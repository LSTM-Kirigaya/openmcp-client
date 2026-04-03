import fs from 'node:fs';
import { Command } from 'commander';
import { DEFAULT_GATEWAY, printResponse, readJsonFile, withGateway } from '../../lib/cli-helpers.js';
import { resolvePayloadFromConfig } from '../../lib/mcp-config.js';
import { rememberSession, removeSession, requireClientId } from '../../lib/mcp-session-store.js';
import { parseResourceScope, toLocalScopePayload } from '../../lib/storage-scope.js';
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

function parseAnyJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { throw new Error('JSON 解析失败'); }
}

function readAnyJsonFile(filePath: string): unknown {
  return parseAnyJson(fs.readFileSync(filePath, 'utf-8'));
}

function loadConnectionEntryFromOptions(options: {
  file?: string;
  data?: string;
  mcpServer?: string;
}): unknown {
  const source = typeof options.file === 'string' && options.file.trim()
    ? readAnyJsonFile(options.file)
    : typeof options.data === 'string' && options.data.trim()
      ? parseAnyJson(options.data)
      : undefined;
  if (source === undefined) {
    throw new Error('请使用 --file 或 --data 提供连接定义');
  }
  if (Array.isArray(source)) return source;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const maybeRecord = source as Record<string, unknown>;
    if (maybeRecord.mcpServers) {
      return resolvePayloadFromConfig(maybeRecord, options.mcpServer);
    }
    return maybeRecord;
  }
  throw new Error('连接定义必须是 JSON 对象或数组');
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

export const connectionCommand = new Command('connection')
  .alias('connections')
  .description('MCP Server 连接管理：本地连接 CRUD、建立/断开连接、云端项目快捷连接');

/* ── list ── */

gw(
  connectionCommand
    .command('list')
    .description('列出本地已保存连接')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace scope 对应的工作区路径')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope, false);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('connections/list', {
            ...toLocalScopePayload(scope, options.workspace)
          });
          printResponse('connections/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── get ── */

gw(
  connectionCommand
    .command('get')
    .description('获取单个本地连接')
    .requiredOption('--id <id>', '连接 ID')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace scope 对应的工作区路径')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope, false);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('connections/get', {
            id: options.id,
            ...toLocalScopePayload(scope, options.workspace)
          });
          printResponse('connections/get', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── save ── */

gw(
  connectionCommand
    .command('save')
    .description('保存或更新本地连接')
    .option('--id <id>', '已有连接 ID')
    .option('--name <name>', '覆盖连接显示名')
    .option('-f, --file <path>', '连接 JSON 文件')
    .option('--data <json>', '内联 JSON')
    .option('--mcp-server <name>', '当输入为 mcpServers 聚合格式时指定 server 名')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace scope 对应的工作区路径')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope, false);
        const item = loadConnectionEntryFromOptions(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('connections/save', {
            id: options.id,
            name: options.name,
            item,
            ...toLocalScopePayload(scope, options.workspace)
          });
          printResponse('connections/save', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── delete ── */

gw(
  connectionCommand
    .command('delete')
    .description('删除本地连接')
    .requiredOption('--id <id>', '连接 ID')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace scope 对应的工作区路径')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope, false);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('connections/delete', {
            id: options.id,
            ...toLocalScopePayload(scope, options.workspace)
          });
          printResponse('connections/delete', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── connect ── */

gw(
  connectionCommand
    .command('connect')
    .description('用已保存的本地连接建立会话')
    .requiredOption('--id <id>', '连接 ID')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace scope 对应的工作区路径')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope, false);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('connections/connect', {
            id: options.id,
            ...toLocalScopePayload(scope, options.workspace)
          }, 120000);
          printResponse('connections/connect', res);
          if (res.code === 200 || res.code === 207) {
            rememberConnectedSessions(options.gateway, res);
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
  connectionCommand
    .command('disconnect')
    .description('断开连接')
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
  connectionCommand
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
