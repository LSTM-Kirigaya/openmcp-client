import { Command } from 'commander';
import { DEFAULT_GATEWAY, parseJsonData, printResponse, readJsonObjectFile, withGateway } from '../../lib/cli-helpers.js';
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

const BATCH_RUN_HELP = `
Input format:
  --data and --file must contain a JSON object. A file uses the same JSON shape as --data.

Example request:
  {"messages":[{"role":"assistant","content":"The result is correct."}],"testCases":[{"id":"case-1","expectedCriteria":"The answer should be correct."}],"evaluationMode":"pass-fail","llmConfig":{"baseURL":"http://127.0.0.1:11434/v1","apiKey":"sk-xxx","model":"judge-model","useAnthropicProtocol":false}}

Examples:
  openmcp debug batch run --data '{"messages":[{"role":"assistant","content":"ok"}],"testCases":[{"id":"case-1","expectedCriteria":"should be ok"}],"evaluationMode":"pass-fail","llmConfig":{"baseURL":"http://127.0.0.1:11434/v1","apiKey":"sk-xxx","model":"judge-model","useAnthropicProtocol":false}}'
  openmcp debug batch run --file ./batch-run.json
`;

const BATCH_SAVE_HELP = `
Input format:
  --data and --file must contain one validation suite JSON object.

Example suite:
  {"id":"suite-1","name":"Echo suite","storage":{"testCases":[{"id":"case-1","input":"hello","criteria":["contains greeting"]}],"selectedCaseIndex":0,"evaluationMode":"pass-fail"}}

Examples:
  openmcp debug batch save --data '{"id":"suite-1","name":"Echo suite","storage":{"testCases":[]}}'
  openmcp debug batch save --file ./suite.json
`;

function loadObjectInput(options: { file?: string; data?: string }, helpCommand: string): Record<string, unknown> {
  if (options.file) {
    return readJsonObjectFile(options.file);
  }
  if (!options.data) {
    throw new Error(`Please provide JSON with --file or --data.\nSee: ${helpCommand} --help`);
  }
  return parseJsonData(options.data, '--data');
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
    .addHelpText('after', BATCH_RUN_HELP)
    .action(async (options) => {
      try {
        const body = loadObjectInput(options, 'openmcp debug batch run');
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
    .addHelpText('after', BATCH_SAVE_HELP)
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope);
        const suite = loadObjectInput(options, 'openmcp debug batch save');
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
