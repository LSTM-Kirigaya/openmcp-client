import { Command } from 'commander';
import { parseJsonData, printResponse, withGateway, DEFAULT_GATEWAY, readJsonFile } from '../lib/cli-helpers.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function normalizeBatchValidationPayload(source: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (source.name !== undefined) body.name = source.name;
  if (source.description !== undefined) body.description = source.description;
  if (source.testCasesJSON !== undefined) body.testCasesJSON = source.testCasesJSON;
  if (source.test_cases_json !== undefined) body.testCasesJSON = source.test_cases_json;
  if (source.presetsJSON !== undefined) body.presetsJSON = source.presetsJSON;
  if (source.presets_json !== undefined) body.presetsJSON = source.presets_json;
  if (source.resultGroupsJSON !== undefined) body.resultGroupsJSON = source.resultGroupsJSON;
  if (source.result_groups_json !== undefined) body.resultGroupsJSON = source.result_groups_json;
  return body;
}

function buildPayload(options: Record<string, unknown>): Record<string, unknown> {
  const fromData = normalizeBatchValidationPayload(parseJsonData(options.data as string | undefined));
  const fromFile = normalizeBatchValidationPayload(
    typeof options.file === 'string' && options.file.trim() ? readJsonFile(options.file) : {}
  );
  const body: Record<string, unknown> = {
    ...fromFile,
    ...fromData
  };
  if (options.name !== undefined) body.name = options.name;
  if (options.description !== undefined) body.description = options.description;
  if (options.testCasesJson !== undefined) body.testCasesJSON = options.testCasesJson;
  if (options.presetsJson !== undefined) body.presetsJSON = options.presetsJson;
  if (options.resultGroupsJson !== undefined) body.resultGroupsJSON = options.resultGroupsJson;
  return body;
}

export const batchValidationCasesCmd = new Command('batch-validation-cases')
  .description('项目级批量验证集合（batch-validation-cases/*）云端能力');

gw(
  batchValidationCasesCmd
    .command('list')
    .description('列出批量验证集合（batch-validation-cases/list）')
    .requiredOption('--project-id <id>', '项目ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('batch-validation-cases/list', {
          projectId: options.projectId
        });
        printResponse('batch-validation-cases/list', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  batchValidationCasesCmd
    .command('get')
    .description('获取单个批量验证集合（batch-validation-cases/get）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--case-id <id>', '集合ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('batch-validation-cases/get', {
          projectId: options.projectId,
          caseId: options.caseId
        });
        printResponse('batch-validation-cases/get', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  batchValidationCasesCmd
    .command('create')
    .description('创建批量验证集合（batch-validation-cases/create）')
    .requiredOption('--project-id <id>', '项目ID')
    .option('--name <name>', '集合名称')
    .option('--description <text>', '描述')
    .option('--test-cases-json <json>', 'test_cases_json 字符串')
    .option('--presets-json <json>', 'presets_json 字符串')
    .option('--result-groups-json <json>', 'result_groups_json 字符串')
    .option('--data <json>', 'JSON 对象字符串，可含 name/description/testCasesJSON/presetsJSON/resultGroupsJSON')
    .option('--file <path>', 'JSON 文件，可含 name/description/test_cases_json/presets_json/result_groups_json')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const body = buildPayload(options);
        if (!body.name) {
          throw new Error('name is required');
        }
        const res = await bridge.commandRequest('batch-validation-cases/create', {
          projectId: options.projectId,
          ...body
        });
        printResponse('batch-validation-cases/create', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  batchValidationCasesCmd
    .command('update')
    .description('更新批量验证集合（batch-validation-cases/update）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--case-id <id>', '集合ID')
    .option('--name <name>', '集合名称')
    .option('--description <text>', '描述')
    .option('--test-cases-json <json>', 'test_cases_json 字符串')
    .option('--presets-json <json>', 'presets_json 字符串')
    .option('--result-groups-json <json>', 'result_groups_json 字符串')
    .option('--data <json>', 'JSON 对象字符串，可含 name/description/testCasesJSON/presetsJSON/resultGroupsJSON')
    .option('--file <path>', 'JSON 文件，可含 name/description/test_cases_json/presets_json/result_groups_json')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const body = buildPayload(options);
        if (!body.name) {
          throw new Error('name is required');
        }
        const res = await bridge.commandRequest('batch-validation-cases/update', {
          projectId: options.projectId,
          caseId: options.caseId,
          ...body
        });
        printResponse('batch-validation-cases/update', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);

gw(
  batchValidationCasesCmd
    .command('delete')
    .description('删除批量验证集合（batch-validation-cases/delete）')
    .requiredOption('--project-id <id>', '项目ID')
    .requiredOption('--case-id <id>', '集合ID')
    .action(async (options) => {
      await withGateway(options.gateway, async (bridge) => {
        const res = await bridge.commandRequest('batch-validation-cases/delete', {
          projectId: options.projectId,
          caseId: options.caseId
        });
        printResponse('batch-validation-cases/delete', res);
        if (res.code !== 200) process.exitCode = 1;
      });
    })
);
