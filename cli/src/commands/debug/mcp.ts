import { Command } from 'commander';
import {
  printJson,
  printResponse,
  withGateway,
  DEFAULT_GATEWAY,
  readJsonFile,
  writeJsonFile
} from '../../lib/cli-helpers.js';
import {
  buildTemplate,
  normalizeConnectionType,
  payloadToMcpServer,
  previewMergedEnv,
  resolvePayloadFromConfig,
  validateConfig
} from '../../lib/mcp-config.js';
import {
  getSessionByClientId,
  rememberSession,
  requireClientId
} from '../../lib/mcp-session-store.js';
import { findRpcHistoryById, getRpcHistoryPath, queryRpcHistory } from '../../lib/rpc-history.js';
import { diagnoseThrownError } from '../../lib/error-diagnose.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function resolveClientIdForCommand(options: { clientId?: string; gateway: string }): string {
  const clientId = requireClientId(options.clientId);
  rememberSession(clientId, options.gateway);
  return clientId;
}

function printThrown(error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  console.error(text);
  for (const tip of diagnoseThrownError(error)) {
    console.error(`[diagnose] ${tip}`);
  }
  process.exitCode = 1;
}

export const mcpRawCommand = new Command('mcp')
  .description('MCP 原生协议命令：ping、会话、配置、历史等');

/* ── ping ── */

gw(
  mcpRawCommand
    .command('ping')
    .description('检测 MCP 会话是否仍在线')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('ping', { clientId });
          printResponse('ping', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

/* ── server-version ── */

gw(
  mcpRawCommand
    .command('server-version')
    .description('获取已连接 MCP Server 的实现信息')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('server/version', { clientId });
          printResponse('server/version', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

/* ── lookup-env ── */

gw(
  mcpRawCommand
    .command('lookup-env')
    .description('按 key 列表解析当前进程环境')
    .requiredOption('--keys <keys>', '逗号分隔，如 USER,HOME,PATH')
    .action(async (options) => {
      try {
        const keys = String(options.keys)
          .split(',')
          .map((k: string) => k.trim())
          .filter(Boolean);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('lookup-env-var', { keys });
          printResponse('lookup-env-var', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

/* ── sessions（已迁移到 mcp session） ── */

mcpRawCommand
  .command('sessions')
  .description('[已迁移] 请使用 "mcp session list/current/recent/use"')
  .action(() => {
    console.log('此命令已迁移，请使用:');
    console.log('  openmcp-cli mcp session list       列出活跃会话');
    console.log('  openmcp-cli mcp session current     查看当前默认会话');
    console.log('  openmcp-cli mcp session recent      查看最近连接记录');
    console.log('  openmcp-cli mcp session use         切换默认会话');
  });

/* ── config ── */

const configCmd = new Command('config').description('MCP 配置生命周期：校验、模板、导出、env 预览');

configCmd
  .command('validate')
  .description('校验配置文件结构与连接字段')
  .requiredOption('-f, --file <path>', '配置文件路径')
  .action((options) => {
    try {
      const config = readJsonFile(options.file);
      const result = validateConfig(config);
      printJson(result);
      if (!result.ok) process.exitCode = 1;
    } catch (error) {
      printThrown(error);
    }
  });

configCmd
  .command('init')
  .description('生成模板配置')
  .option('--template <kind>', 'stdio | sse | http', 'stdio')
  .requiredOption('-o, --output <path>', '输出文件')
  .action((options) => {
    const kind = String(options.template).toLowerCase() as 'stdio' | 'sse' | 'http';
    if (!['stdio', 'sse', 'http'].includes(kind)) {
      printThrown('模板仅支持 stdio|sse|http');
      return;
    }
    const template = buildTemplate(kind);
    writeJsonFile(options.output, template);
    printJson({ ok: true, output: options.output, template: kind });
  });

configCmd
  .command('export')
  .description('从本地会话记录导出 mcpServers 配置')
  .requiredOption('--client-id <id>', '会话 clientId')
  .requiredOption('-o, --output <path>', '输出文件')
  .option('--name <name>', 'mcpServers 的 server 名称')
  .action((options) => {
    const session = getSessionByClientId(options.clientId);
    if (!session?.connectPayload) {
      printThrown('该会话没有可导出的 connectPayload，请先重新 connect 一次。');
      return;
    }
    const serverName = options.name || `server-${options.clientId.slice(0, 8)}`;
    const out = {
      version: '1.0.0',
      mcpServers: {
        [serverName]: payloadToMcpServer(session.connectPayload)
      }
    };
    writeJsonFile(options.output, out);
    printJson({ ok: true, output: options.output, serverName });
  });

configCmd
  .command('env-preview')
  .description('展示配置解析后的 env 注入结果')
  .requiredOption('-f, --file <path>', '配置文件路径')
  .option('--mcp-server <name>', '聚合配置时指定 server')
  .action((options) => {
    try {
      const config = readJsonFile(options.file);
      const payload = resolvePayloadFromConfig(config, options.mcpServer as string | undefined);
      const preview = previewMergedEnv(payload);
      printJson({
        connectionType: payload.connectionType,
        injectedKeys: preview.injectedKeys,
        mergedEnv: preview.env
      });
    } catch (error) {
      printThrown(error);
    }
  });

mcpRawCommand.addCommand(configCmd);

/* ── history ── */

const historyCmd = new Command('history').description('CLI 调用历史与回放');

historyCmd
  .command('list')
  .description('列出调用历史')
  .option('--limit <n>', '数量，默认 20', '20')
  .option('--command <name>', '按命令过滤，如 tools/call')
  .option('--failed', '仅失败请求', false)
  .action((options) => {
    const limit = Number(options.limit || 20);
    const rows = queryRpcHistory({
      limit,
      command: options.command,
      failedOnly: Boolean(options.failed)
    });
    printJson({ path: getRpcHistoryPath(), total: rows.length, rows });
  });

gw(
  historyCmd
    .command('replay')
    .description('回放历史请求')
    .option('--id <id>', '按记录 ID 回放单条')
    .option('--failed', '回放最近失败记录', false)
    .option('--limit <n>', '失败回放数量，默认 1', '1')
    .action(async (options) => {
      try {
        const tasks = options.id
          ? [findRpcHistoryById(options.id)].filter(Boolean)
          : queryRpcHistory({ failedOnly: Boolean(options.failed), limit: Number(options.limit || 1) });
        if (tasks.length === 0) {
          throw new Error('未找到可回放的历史记录');
        }

        await withGateway(options.gateway, async (bridge) => {
          for (const row of tasks as any[]) {
            const req = { ...(row.request || {}) };
            delete (req as any)._id;
            const res = await bridge.commandRequest(row.command, req);
            printResponse(row.command, res);
            if (res.code !== 200) process.exitCode = 1;
          }
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

mcpRawCommand.addCommand(historyCmd);
