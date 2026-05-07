import fs from 'node:fs';
import { Command } from 'commander';
import { DEFAULT_GATEWAY, printResponse, withGateway } from '../../lib/cli-helpers.js';
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

function target(options: { connectionId?: string; clientId?: string }) {
  if (options.connectionId?.trim()) return { connectionId: options.connectionId.trim() };
  if (options.clientId?.trim()) return { clientId: options.clientId.trim() };
  return {};
}

export const batchCommand = new Command('batch')
  .description('Batch validation execution and local suite management');

gw(
  batchCommand
    .command('run')
    .description('Run batch validation')
    .option('-f, --file <path>', 'JSON request file')
    .option('--data <json>', 'inline JSON request')
    .action(async (options) => {
      try {
        const body = loadObjectInput(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('batch-validation/run', body, 120000);
          printResponse('batch-validation/run', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  batchCommand
    .command('list')
    .description('List local validation suites')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace path')
    .option('--connection-id <id>', 'local connection id')
    .option('--client-id <id>', 'clientId')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('validation-suites/list', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target(options)
          });
          printResponse('validation-suites/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  batchCommand
    .command('get')
    .requiredOption('--suite-id <id>', 'suite id')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace path')
    .option('--connection-id <id>', 'local connection id')
    .option('--client-id <id>', 'clientId')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('validation-suites/get', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target(options),
            suiteId: options.suiteId
          });
          printResponse('validation-suites/get', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  batchCommand
    .command('save')
    .option('--suite-id <id>', 'existing suite id')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace path')
    .option('--connection-id <id>', 'local connection id')
    .option('--client-id <id>', 'clientId')
    .option('-f, --file <path>', 'JSON file')
    .option('--data <json>', 'inline JSON')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope);
        const suite = loadObjectInput(options);
        if (options.suiteId) suite.id = options.suiteId;
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('validation-suites/upsert', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target(options),
            suite
          });
          printResponse('validation-suites/upsert', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

gw(
  batchCommand
    .command('delete')
    .requiredOption('--suite-id <id>', 'suite id')
    .option('--scope <scope>', 'user | workspace', 'user')
    .option('--workspace <path>', 'workspace path')
    .option('--connection-id <id>', 'local connection id')
    .option('--client-id <id>', 'clientId')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('validation-suites/delete', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target(options),
            suiteId: options.suiteId
          });
          printResponse('validation-suites/delete', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);
