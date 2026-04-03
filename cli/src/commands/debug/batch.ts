import fs from 'node:fs';
import { Command } from 'commander';
import { DEFAULT_GATEWAY, parseJsonData, printJson, printResponse, readJsonFile, withGateway } from '../../lib/cli-helpers.js';
import { getCurrentClientId } from '../../lib/mcp-session-store.js';
import { parseResourceScope, requireProjectId, toLocalScopePayload, type ResourceScope } from '../../lib/storage-scope.js';

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function parseAnyJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { throw new Error('JSON 解析失败'); }
}

function readAnyJsonFile(filePath: string): unknown {
  return parseAnyJson(fs.readFileSync(filePath, 'utf-8'));
}

function loadObjectInput(options: { file?: string; data?: string }): Record<string, unknown> {
  const source = typeof options.file === 'string' && options.file.trim()
    ? readAnyJsonFile(options.file)
    : typeof options.data === 'string' && options.data.trim()
      ? parseAnyJson(options.data)
      : undefined;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('请使用 --file 或 --data 提供 JSON 对象');
  }
  return source as Record<string, unknown>;
}

function resolveLocalConnectionTarget(options: { connectionId?: string; clientId?: string }): {
  connectionId?: string;
  clientId?: string;
} {
  if (options.connectionId?.trim()) return { connectionId: options.connectionId.trim() };
  if (options.clientId?.trim()) return { clientId: options.clientId.trim() };
  const currentClientId = getCurrentClientId();
  if (currentClientId) return { clientId: currentClientId };
  throw new Error('本地 batch 需要 --connection-id，或使用已连接的当前默认会话');
}

function stringifyMaybeJson(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
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

function buildCloudPayload(options: Record<string, unknown>): Record<string, unknown> {
  const fromData = normalizeBatchValidationPayload(parseJsonData(options.data as string | undefined));
  const fromFile = normalizeBatchValidationPayload(
    typeof options.file === 'string' && options.file.trim() ? readJsonFile(options.file) : {}
  );
  const body: Record<string, unknown> = { ...fromFile, ...fromData };
  if (options.name !== undefined) body.name = options.name;
  if (options.description !== undefined) body.description = options.description;
  if (options.testCasesJson !== undefined) body.testCasesJSON = options.testCasesJson;
  if (options.presetsJson !== undefined) body.presetsJSON = options.presetsJson;
  if (options.resultGroupsJson !== undefined) body.resultGroupsJSON = options.resultGroupsJson;
  return body;
}

function normalizeLocalSuitePayload(
  raw: Record<string, unknown>,
  options: { suiteId?: string }
): Record<string, unknown> {
  return { ...raw, id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : options.suiteId };
}

function normalizeCloudSuitePayload(
  raw: Record<string, unknown>,
  options: { suiteId?: string }
): Record<string, unknown> {
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!name.trim()) throw new Error('cloud batch 需要 name');
  const storage = raw.storage && typeof raw.storage === 'object' && !Array.isArray(raw.storage)
    ? raw.storage as Record<string, unknown>
    : undefined;
  return {
    caseId: options.suiteId,
    name,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    testCasesJSON: stringifyMaybeJson(raw.testCasesJSON ?? raw.test_cases_json ?? storage?.testCases),
    presetsJSON: stringifyMaybeJson(raw.presetsJSON ?? raw.presets_json ?? storage?.comprehensivePresets),
    resultGroupsJSON: stringifyMaybeJson(raw.resultGroupsJSON ?? raw.result_groups_json ?? storage?.resultGroups)
  };
}

export const batchCommand = new Command('batch')
  .description('批量验证管理与执行');

/* ── batch list ── */

gw(
  batchCommand
    .command('list')
    .description('列出验证套件')
    .option('--scope <scope>', 'user | workspace | cloud', 'user')
    .option('--workspace <path>', 'workspace scope 对应的工作区路径')
    .option('--project-id <id>', 'cloud scope 的项目 ID')
    .option('--connection-id <id>', '本地连接 ID')
    .option('--client-id <id>', '当前会话 clientId')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope, true);
        const projectId = requireProjectId(scope, options.projectId);
        if (scope === 'cloud') {
          await withGateway(options.gateway, async (bridge) => {
            const res = await bridge.commandRequest('batch-validation-cases/list', { projectId });
            printResponse('batch-validation-cases/list', res);
            if (res.code !== 200) process.exitCode = 1;
          });
          return;
        }
        await withGateway(options.gateway, async (bridge) => {
          const target = resolveLocalConnectionTarget(options);
          const res = await bridge.commandRequest('validation-suites/list', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target
          });
          printResponse('validation-suites/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── batch get ── */

gw(
  batchCommand
    .command('get')
    .description('获取单个验证套件')
    .requiredOption('--suite-id <id>', '套件 ID')
    .option('--scope <scope>', 'user | workspace | cloud', 'user')
    .option('--workspace <path>', 'workspace scope 对应的工作区路径')
    .option('--project-id <id>', 'cloud scope 的项目 ID')
    .option('--connection-id <id>', '本地连接 ID')
    .option('--client-id <id>', '当前会话 clientId')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope, true);
        const projectId = requireProjectId(scope, options.projectId);
        await withGateway(options.gateway, async (bridge) => {
          if (scope === 'cloud') {
            const res = await bridge.commandRequest('batch-validation-cases/get', {
              projectId, caseId: options.suiteId
            });
            printResponse('batch-validation-cases/get', res);
            if (res.code !== 200) process.exitCode = 1;
            return;
          }
          const target = resolveLocalConnectionTarget(options);
          const res = await bridge.commandRequest('validation-suites/get', {
            suiteId: options.suiteId,
            ...toLocalScopePayload(scope, options.workspace),
            ...target
          });
          printResponse('validation-suites/get', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── batch save ── */

gw(
  batchCommand
    .command('save')
    .description('创建或更新验证套件')
    .option('--suite-id <id>', '已有套件 ID；用于 update')
    .option('--scope <scope>', 'user | workspace | cloud', 'user')
    .option('--workspace <path>', 'workspace scope 对应的工作区路径')
    .option('--project-id <id>', 'cloud scope 的项目 ID')
    .option('--connection-id <id>', '本地连接 ID')
    .option('--client-id <id>', '当前会话 clientId')
    .option('-f, --file <path>', 'JSON 文件')
    .option('--data <json>', '内联 JSON')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope, true);
        const projectId = requireProjectId(scope, options.projectId);
        const raw = loadObjectInput(options);
        await withGateway(options.gateway, async (bridge) => {
          if (scope === 'cloud') {
            const payload = normalizeCloudSuitePayload(raw, {
              suiteId: options.suiteId as string | undefined
            });
            const command = options.suiteId ? 'batch-validation-cases/update' : 'batch-validation-cases/create';
            const res = await bridge.commandRequest(command, { projectId, ...payload });
            printResponse(command, res);
            if (res.code !== 200) process.exitCode = 1;
            return;
          }
          const target = resolveLocalConnectionTarget(options);
          const res = await bridge.commandRequest('validation-suites/upsert', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target,
            suite: normalizeLocalSuitePayload(raw, { suiteId: options.suiteId as string | undefined })
          });
          printResponse('validation-suites/upsert', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── batch delete ── */

gw(
  batchCommand
    .command('delete')
    .description('删除验证套件')
    .requiredOption('--suite-id <id>', '套件 ID')
    .option('--scope <scope>', 'user | workspace | cloud', 'user')
    .option('--workspace <path>', 'workspace scope 对应的工作区路径')
    .option('--project-id <id>', 'cloud scope 的项目 ID')
    .option('--connection-id <id>', '本地连接 ID')
    .option('--client-id <id>', '当前会话 clientId')
    .action(async (options) => {
      try {
        const scope = parseResourceScope(options.scope, true);
        const projectId = requireProjectId(scope, options.projectId);
        await withGateway(options.gateway, async (bridge) => {
          if (scope === 'cloud') {
            const res = await bridge.commandRequest('batch-validation-cases/delete', {
              projectId, caseId: options.suiteId
            });
            printResponse('batch-validation-cases/delete', res);
            if (res.code !== 200) process.exitCode = 1;
            return;
          }
          const target = resolveLocalConnectionTarget(options);
          const res = await bridge.commandRequest('validation-suites/delete', {
            suiteId: options.suiteId,
            ...toLocalScopePayload(scope, options.workspace),
            ...target
          });
          printResponse('validation-suites/delete', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

/* ── batch run ── */

gw(
  batchCommand
    .command('run')
    .description('执行批量验证')
    .option('-f, --file <path>', '完整请求 JSON')
    .option('-d, --data <json>', '内联 JSON')
    .action(async (options) => {
      try {
        let body: Record<string, unknown> = {};
        if (options.data) body = { ...body, ...parseJsonData(options.data) };
        if (options.file) body = { ...body, ...readJsonFile(options.file) };
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('batch-validation/run', body, 600000);
          printJson(res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        console.error(text);
        process.exitCode = 1;
      }
    })
);
