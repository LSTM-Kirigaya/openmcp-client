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
  reconcileGatewaySessions,
  removeSession,
  resolveClientIdWithGateway
} from '../../lib/mcp-session-store.js';
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

function activeClientIdsFromResponse(msg: unknown): string[] {
  return Array.isArray(msg)
    ? msg
      .map((session: any) => session?.clientId)
      .filter((clientId: unknown): clientId is string => typeof clientId === 'string')
    : [];
}

export const mcpSessionCommand = new Command('session')
  .description('Manage MCP runtime sessions')
  .addHelpText('after', `
Examples:
  openmcp mcp session list
  openmcp mcp session connect --id <SERVER_ID>
  openmcp mcp session disconnect
  openmcp mcp session current
  openmcp mcp session use --client-id <ID>

Notes:
  session list shows active sessions in Gateway.
  session current shows the local default session used when --client-id is omitted.
  session use only accepts a clientId that is currently active in Gateway.
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
          if (res.code === 200) {
            reconcileGatewaySessions(options.gateway, activeClientIdsFromResponse(res.msg));
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
    .command('current')
    .description('Show current default session')
    .action(() => {
      printJson({
        currentClientId: getCurrentClientId() ?? null,
        storePath: getSessionStorePath()
      });
    })
);

gw(
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
    })
);

gw(
  mcpSessionCommand
    .command('use')
    .description('Switch default session to an active Gateway session')
    .requiredOption('--client-id <id>', 'Target active clientId from `openmcp mcp session list`')
    .action(async (options) => {
      try {
        const clientId = String(options.clientId || '').trim();
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('connect/list', {});
          if (res.code !== 200) {
            printResponse('connect/list', res);
            process.exitCode = 1;
            return;
          }

          const activeClientIds = activeClientIdsFromResponse(res.msg);
          if (!activeClientIds.includes(clientId)) {
            console.error(`Session is not active in Gateway: ${clientId}`);
            if (activeClientIds.length > 0) {
              console.error(`Active sessions: ${activeClientIds.join(', ')}`);
            } else {
              console.error('No active sessions in Gateway. Run `openmcp mcp session connect --id <SERVER_ID>` first.');
            }
            process.exitCode = 1;
            return;
          }

          rememberSession(clientId, options.gateway);
          printJson({ ok: true, currentClientId: clientId, gateway: options.gateway });
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

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
        await withGateway(options.gateway, async (bridge) => {
          const clientId = await resolveClientIdWithGateway(options, bridge);
          const res = await bridge.commandRequest('disconnect', { clientId });
          printResponse('disconnect', res);
          if (res.code === 200 || isMissingSessionResponse(res as any)) removeSession(clientId);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
