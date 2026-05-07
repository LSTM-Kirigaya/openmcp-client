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

export const mcpSessionCommand = new Command('session')
  .description('Manage MCP runtime sessions')
  .addHelpText('after', `
Examples:
  openmcp-cli mcp session list
  openmcp-cli mcp session connect --id <SERVER_ID>
  openmcp-cli mcp session disconnect
  openmcp-cli mcp session current
  openmcp-cli mcp session use --client-id <ID>
`);

gw(
  mcpSessionCommand
    .command('list')
    .description('List active MCP sessions in Gateway')
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

mcpSessionCommand
  .command('current')
  .description('Show current default session')
  .action(() => {
    printJson({
      currentClientId: getCurrentClientId() ?? null,
      storePath: getSessionStorePath()
    });
  });

mcpSessionCommand
  .command('recent')
  .description('Show recent sessions')
  .option('--limit <n>', 'Result limit, default 20', '20')
  .action((options) => {
    const limit = Number(options.limit || 20);
    printJson({
      currentClientId: getCurrentClientId() ?? null,
      recent: getRecentSessions(limit),
      storePath: getSessionStorePath()
    });
  });

mcpSessionCommand
  .command('use')
  .description('Switch default session')
  .requiredOption('--client-id <id>', 'Target clientId')
  .action((options) => {
    setCurrentClientId(options.clientId);
    printJson({ ok: true, currentClientId: options.clientId });
  });

gw(
  mcpSessionCommand
    .command('connect')
    .description('Connect with a saved local MCP Server')
    .requiredOption('--id <id>', 'Server ID')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const getRes = await bridge.commandRequest('servers/get', { id: options.id });
          if (getRes.code !== 200) {
            console.error(`Server not found: ${options.id}`);
            process.exitCode = 1;
            return;
          }
          const server = getRes.data as Record<string, unknown>;
          const res = await bridge.commandRequest('connect', server, 120000);
          printResponse('connect', res);
          const clientId = (res.msg as any)?.clientId ?? (res.data as any)?.clientId;
          if (res.code === 200 && typeof clientId === 'string') {
            rememberSession(clientId, options.gateway, server);
            console.log(`\nConnected, clientId: ${clientId}`);
          }
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  mcpSessionCommand
    .command('disconnect')
    .description('Disconnect current active MCP session')
    .option('--client-id <id>', 'clientId; defaults to current session')
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
