import { Command } from 'commander';
import { printResponse, withGateway, DEFAULT_GATEWAY } from '../../lib/cli-helpers.js';
import { removeSession, resolveClientIdWithGateway } from '../../lib/mcp-session-store.js';
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

export const resourceCommand = new Command('resource')
  .description('MCP resource operations');

gw(
  resourceCommand
    .command('list')
    .description('List resources')
    .option('--client-id <id>', 'clientId; omit to use the current default session')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const clientId = await resolveClientIdWithGateway(options, bridge);
          const res = await bridge.commandRequest('resources/list', { clientId });
          printResponse('resources/list', res);
          if (isMissingSessionResponse(res as any)) removeSession(clientId);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  resourceCommand
    .command('get')
    .description('Read resource content by URI')
    .option('--client-id <id>', 'clientId; omit to use the current default session')
    .requiredOption('--uri <uri>', 'MCP resource URI')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const clientId = await resolveClientIdWithGateway(options, bridge);
          const res = await bridge.commandRequest('resources/read', { clientId, resourceUri: options.uri });
          printResponse('resources/read', res);
          if (isMissingSessionResponse(res as any)) removeSession(clientId);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  resourceCommand
    .command('templates')
    .description('List resource templates')
    .option('--client-id <id>', 'clientId; omit to use the current default session')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const clientId = await resolveClientIdWithGateway(options, bridge);
          const res = await bridge.commandRequest('resources/templates/list', { clientId });
          printResponse('resources/templates/list', res);
          if (isMissingSessionResponse(res as any)) removeSession(clientId);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
