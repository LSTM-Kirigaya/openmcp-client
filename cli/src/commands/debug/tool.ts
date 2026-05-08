import fs from 'node:fs';
import { Command } from 'commander';
import { DEFAULT_GATEWAY, parseJsonData, printResponse, withGateway } from '../../lib/cli-helpers.js';
import { rememberSession, requireClientId } from '../../lib/mcp-session-store.js';
import { diagnoseThrownError } from '../../lib/error-diagnose.js';
import { parseResourceScope, toLocalScopePayload } from '../../lib/storage-scope.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function printThrown(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  for (const tip of diagnoseThrownError(error)) {
    console.error(`[diagnose] ${tip}`);
  }
  process.exitCode = 1;
}

function resolveClientId(options: { clientId?: string; gateway: string }): string {
  const clientId = requireClientId(options.clientId);
  rememberSession(clientId, options.gateway);
  return clientId;
}

function loadObjectInput(options: { file?: string; data?: string }): Record<string, unknown> {
  const raw = options.file
    ? fs.readFileSync(options.file, 'utf-8')
    : options.data;
  if (!raw) {
    throw new Error('Please provide JSON with --file or --data');
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Input must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function responseText(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? value : '';
  }
  const msg = value as { content?: unknown };
  if (!Array.isArray(msg.content)) {
    return JSON.stringify(value);
  }
  return msg.content
    .map((item) => {
      if (item && typeof item === 'object' && 'text' in item) {
        return String((item as { text?: unknown }).text ?? '');
      }
      return JSON.stringify(item);
    })
    .filter(Boolean)
    .join('\n');
}

function printToolCallAdvice(toolName: string, argsRaw: string | undefined, msg: unknown): void {
  if (!(msg && typeof msg === 'object' && (msg as { isError?: unknown }).isError)) {
    return;
  }

  const text = responseText(msg);
  const validationLike = /invalid arguments|input validation|required|invalid_type/i.test(text);
  if (!validationLike) {
    console.error('[diagnose] Tool returned an error. Check the tool output above and Gateway logs if needed.');
    return;
  }

  console.error('[diagnose] Tool arguments were rejected by the MCP server.');
  console.error('[diagnose] Run `openmcp debug tool list` to inspect tool names and inputSchema.');
  if (!argsRaw || argsRaw.trim() === '{}' || argsRaw.trim() === '') {
    if (toolName === 'echo') {
      console.error('[diagnose] Example: openmcp debug tool call --name echo --args \'{"message":"hi"}\'');
    } else {
      console.error(`[diagnose] Pass a JSON object with --args, for example: openmcp debug tool call --name ${toolName} --args '{"key":"value"}'`);
    }
  }
}

function target(options: { connectionId?: string; clientId?: string }) {
  if (options.connectionId?.trim()) return { connectionId: options.connectionId.trim() };
  if (options.clientId?.trim()) return { clientId: options.clientId.trim() };
  return {};
}

export const toolCommand = new Command('tool')
  .description('Tool debugging and local test-case management');

gw(
  toolCommand
    .command('list')
    .description('List tools')
    .option('--client-id <id>', 'clientId; defaults to current session')
    .action(async (options) => {
      try {
        const clientId = resolveClientId(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('tools/list', { clientId });
          printResponse('tools/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  toolCommand
    .command('call')
    .description('Call a tool with JSON arguments')
    .option('--client-id <id>', 'clientId; defaults to current session')
    .requiredOption('--name <name>', 'Tool name from `openmcp debug tool list`')
    .option('-a, --args <json>', 'Tool args as a JSON object, e.g. \'{"message":"hi"}\'', '{}')
    .addHelpText('after', `
Examples:
  # 1) List tools first and inspect each tool inputSchema
  openmcp debug tool list

  # 2) Call a tool using the current default MCP session
  openmcp debug tool call --name echo --args '{"message":"hi"}'

  # 3) Call a tool with an explicit clientId
  openmcp debug tool call --client-id <clientId> --name echo --args '{"message":"hi"}'

Notes:
  --args must be a JSON object. Required keys depend on the tool's inputSchema.
  In PowerShell, simple objects like '{"message":"hi"}' may arrive as {message:hi}; the CLI accepts that form.
  For complex JSON in PowerShell, escape the quotes: --args '{\\"message\\":\\"hi\\"}'
`)
    .action(async (options) => {
      try {
        const clientId = resolveClientId(options);
        const toolArgs = parseJsonData(options.args, '--args');
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('tools/call', { clientId, toolName: options.name, toolArgs });
          printResponse('tools/call', res);
          printToolCallAdvice(options.name, options.args, res.msg);
          if (res.code !== 200 || (res.msg as any)?.isError) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

const testCaseCmd = new Command('test-case')
  .alias('test-cases')
  .description('Manage local tool test cases');

gw(
  testCaseCmd
    .command('list')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace path')
    .option('--connection-id <id>', 'local connection id')
    .option('--client-id <id>', 'clientId')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('test-cases/list', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target(options)
          });
          printResponse('test-cases/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  testCaseCmd
    .command('get')
    .requiredOption('--case-id <id>', 'test case id')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace path')
    .option('--connection-id <id>', 'local connection id')
    .option('--client-id <id>', 'clientId')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('test-cases/get', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target(options),
            caseId: options.caseId
          });
          printResponse('test-cases/get', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  testCaseCmd
    .command('save')
    .option('--case-id <id>', 'existing test case id')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace path')
    .option('--connection-id <id>', 'local connection id')
    .option('--client-id <id>', 'clientId')
    .option('-f, --file <path>', 'JSON file')
    .option('--data <json>', 'inline JSON')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope);
        const testCase = loadObjectInput(options);
        if (options.caseId) testCase.id = options.caseId;
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('test-cases/upsert', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target(options),
            testCase
          });
          printResponse('test-cases/upsert', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  testCaseCmd
    .command('delete')
    .requiredOption('--case-id <id>', 'test case id')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace path')
    .option('--connection-id <id>', 'local connection id')
    .option('--client-id <id>', 'clientId')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('test-cases/delete', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target(options),
            caseId: options.caseId
          });
          printResponse('test-cases/delete', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

toolCommand.addCommand(testCaseCmd);
