import { Command } from 'commander';
import { printResponse, withGateway, DEFAULT_GATEWAY, parseJsonData } from '../../lib/cli-helpers.js';
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

export const promptCommand = new Command('prompt')
  .description('MCP prompt operations');

const PROMPT_GET_HELP = `
Input format:
  --data must be a JSON object containing prompt arguments.
  Argument keys come from openmcp debug prompt list output.

Examples:
  openmcp debug prompt get --prompt-id simple-prompt
  openmcp debug prompt get --prompt-id args-prompt --data '{"city":"Shanghai","state":"Shanghai"}'
`;

gw(
  promptCommand
    .command('list')
    .description('List prompts')
    .option('--client-id <id>', 'clientId; omit to use the current default session')
    .action(async (options) => {
      try {
        await withGateway(options.gateway, async (bridge) => {
          const clientId = await resolveClientIdWithGateway(options, bridge);
          const res = await bridge.commandRequest('prompts/list', { clientId });
          printResponse('prompts/list', res);
          if (isMissingSessionResponse(res as any)) removeSession(clientId);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  promptCommand
    .command('get')
    .description('Get a single prompt content')
    .option('--client-id <id>', 'clientId; omit to use the current default session')
    .requiredOption('--prompt-id <id>', 'MCP prompt name/id')
    .option('-d, --data <json>', 'JSON args object passed to getPrompt', '{}')
    .addHelpText('after', PROMPT_GET_HELP)
    .action(async (options) => {
      try {
        const args = parseJsonData(options.data);
        await withGateway(options.gateway, async (bridge) => {
          const clientId = await resolveClientIdWithGateway(options, bridge);
          const res = await bridge.commandRequest('prompts/get', { clientId, promptId: options.promptId, args });
          printResponse('prompts/get', res);
          if (isMissingSessionResponse(res as any)) removeSession(clientId);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
