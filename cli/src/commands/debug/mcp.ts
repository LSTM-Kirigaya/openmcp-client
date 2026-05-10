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
  removeSession,
  resolveClientIdWithGateway
} from '../../lib/mcp-session-store.js';
import { findRpcHistoryById, getRpcHistoryPath, queryRpcHistory } from '../../lib/rpc-history.js';
import { diagnoseThrownError, isMissingSessionResponse } from '../../lib/error-diagnose.js';

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

function parseCsv(value?: string): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function shouldRedactEnvKey(key: string): boolean {
  return /(api[-_]?key|token|secret|password|passwd|authorization|credential)/i.test(key);
}

function maskEnvValue(key: string, value: string, showSecrets: boolean): string {
  if (showSecrets || !shouldRedactEnvKey(key)) return value;
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function selectEnvPreview(
  env: Record<string, string>,
  injectedKeys: string[],
  options: { keys?: string; showProcessEnv?: boolean; showSecrets?: boolean }
): Record<string, string> {
  const selectedKeys = options.showProcessEnv
    ? Object.keys(env).sort()
    : Array.from(new Set([...injectedKeys, ...parseCsv(options.keys)])).sort();

  const selected: Record<string, string> = {};
  for (const key of selectedKeys) {
    if (Object.prototype.hasOwnProperty.call(env, key)) {
      selected[key] = maskEnvValue(key, env[key], Boolean(options.showSecrets));
    }
  }
  return selected;
}

export const mcpRawCommand = new Command('mcp')
  .description('MCP native protocol commands: ping, sessions, config, history, etc.');

/* ── ping ── */

gw(
  mcpRawCommand
    .command('ping')
    .description('Check if MCP session is still online')
    .option('--client-id <id>', 'clientId; omit to use the current default session')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const clientId = await resolveClientIdWithGateway(options, bridge);
          const res = await bridge.commandRequest('ping', { clientId });
          printResponse('ping', res);
          if (isMissingSessionResponse(res as any)) removeSession(clientId);
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
    .description('Get implementation info of the connected MCP Server')
    .option('--client-id <id>', 'clientId; omit to use the current default session')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const clientId = await resolveClientIdWithGateway(options, bridge);
          const res = await bridge.commandRequest('server/version', { clientId });
          printResponse('server/version', res);
          if (isMissingSessionResponse(res as any)) removeSession(clientId);
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
    .description('Parse current process environment by key list')
    .requiredOption('--keys <keys>', 'Comma-separated, e.g. USER,HOME,PATH')
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
  .description('[Migrated] Use "mcp session list/current/recent/use"')
  .action(() => {
    console.log('This command has been migrated. Use:');
    console.log('  openmcp mcp session list       List active sessions');
    console.log('  openmcp mcp session current     View current default session');
    console.log('  openmcp mcp session recent      View recent connection records');
    console.log('  openmcp mcp session use         Switch default session');
  });

/* ── config ── */

const MCP_CONFIG_HELP = `
Config file format:
  Direct OpenMCP shape:
    {"connectionType":"STDIO","command":"npx","args":["-y","@modelcontextprotocol/server-everything"]}
    {"connectionType":"SSE","url":"http://127.0.0.1:3000/sse"}
    {"connectionType":"STREAMABLE_HTTP","url":"http://127.0.0.1:8080/mcp"}

  mcpServers shape:
    {"mcpServers":{"everything":{"command":"npx","args":["-y","@modelcontextprotocol/server-everything"],"env":{"API_KEY":"..."}}}}

Examples:
  openmcp debug mcp config init --template stdio -o ./mcp.json
  openmcp debug mcp config validate -f ./mcp.json
  openmcp debug mcp config env-preview -f ./mcp.json --mcp-server everything
`;

const configCmd = new Command('config')
  .description('MCP config lifecycle: validate, template, export, env preview')
  .addHelpText('after', MCP_CONFIG_HELP);

configCmd
  .command('validate')
  .description('Validate config file structure and connection fields')
  .requiredOption('-f, --file <path>', 'Config file path')
  .addHelpText('after', MCP_CONFIG_HELP)
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
  .description('Generate template config')
  .option('--template <kind>', 'stdio | sse | http', 'stdio')
  .requiredOption('-o, --output <path>', 'Output file')
  .action((options) => {
    const kind = String(options.template).toLowerCase() as 'stdio' | 'sse' | 'http';
    if (!['stdio', 'sse', 'http'].includes(kind)) {
      printThrown('Template only supports stdio|sse|http');
      return;
    }
    const template = buildTemplate(kind);
    writeJsonFile(options.output, template);
    printJson({ ok: true, output: options.output, template: kind });
  });

configCmd
  .command('export')
  .description('Export mcpServers config from local session records')
  .requiredOption('--client-id <id>', 'Session clientId')
  .requiredOption('-o, --output <path>', 'Output file')
  .option('--name <name>', 'mcpServers server name')
  .action((options) => {
    const session = getSessionByClientId(options.clientId);
    if (!session?.connectPayload) {
      printThrown('This session has no exportable connectPayload. Please reconnect first.');
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
  .description('Show env injection result after config parsing')
  .requiredOption('-f, --file <path>', 'Config file path')
  .option('--mcp-server <name>', 'Specify server when using aggregate config')
  .option('--keys <keys>', 'comma-separated env keys to include in mergedEnv')
  .option('--show-process-env', 'include the full merged process env in output', false)
  .option('--show-secrets', 'do not redact secret-looking env values', false)
  .addHelpText('after', MCP_CONFIG_HELP)
  .action((options) => {
    try {
      const config = readJsonFile(options.file);
      const payload = resolvePayloadFromConfig(config, options.mcpServer as string | undefined);
      const preview = previewMergedEnv(payload);
      const mergedEnv = selectEnvPreview(preview.env, preview.injectedKeys, options);
      printJson({
        connectionType: payload.connectionType,
        injectedKeys: preview.injectedKeys,
        mergedEnv,
        omittedKeys: Math.max(0, Object.keys(preview.env).length - Object.keys(mergedEnv).length)
      });
    } catch (error) {
      printThrown(error);
    }
  });

mcpRawCommand.addCommand(configCmd);

/* ── history ── */

const historyCmd = new Command('history').description('CLI call history and replay');

historyCmd
  .command('list')
  .description('List call history')
  .option('--limit <n>', 'Count, default 20', '20')
  .option('--command <name>', 'Filter by command, e.g. tools/call')
  .option('--failed', 'Only failed requests', false)
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
    .description('Replay historical requests')
    .option('--id <id>', 'Replay a single record by ID')
    .option('--failed', 'Replay most recent failed record', false)
    .option('--limit <n>', 'Failed replay count, default 1', '1')
    .action(async (options) => {
      try {
        const tasks = options.id
          ? [findRpcHistoryById(options.id)].filter(Boolean)
          : queryRpcHistory({ failedOnly: Boolean(options.failed), limit: Number(options.limit || 1) });
        if (tasks.length === 0) {
          throw new Error('No replayable history records found');
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
