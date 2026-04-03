import fs from 'node:fs';
import { Command } from 'commander';
import type { MessageBridge, RestFulResponse } from '../../lib/message-bridge.js';
import { printJson, printResponse, withGateway, DEFAULT_GATEWAY, parseJsonData } from '../../lib/cli-helpers.js';
import { getCurrentClientId, rememberSession, requireClientId } from '../../lib/mcp-session-store.js';
import { diagnoseThrownError } from '../../lib/error-diagnose.js';
import { parseResourceScope, requireProjectId, toLocalScopePayload, type ResourceScope } from '../../lib/storage-scope.js';

// ====== Types ======

type ToolCaseStatus = 'pending' | 'passed' | 'failed' | 'running' | 'timeout';

type ToolCallResponse = {
  isError?: boolean;
  content?: Array<{
    type?: string;
    text?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

type StoredToolTestCase = {
  id: string;
  name: string;
  toolName: string;
  description?: string;
  input: Record<string, unknown>;
  expectedOutput?: unknown;
  actualOutput?: unknown;
  status?: ToolCaseStatus;
  createdAt: number;
  updatedAt: number;
};

type LoadedToolCasesPayload = {
  testCases?: unknown;
};

type ToolValidationResult = {
  id: string;
  name: string;
  toolName: string;
  status: ToolCaseStatus;
  durationMs: number;
  hasExpectedOutput: boolean;
  matchedExpectedOutput: boolean;
  actualOutput: unknown;
  expectedOutput?: unknown;
  error?: string;
};

type CloudSpecCase = {
  id: string;
  parent_id?: string | null;
  node_type: string;
  type: string;
  tool_name?: string;
  name: string;
  input?: string;
  output?: string;
  description?: string;
  children?: CloudSpecCase[];
};

// ====== Helpers ======

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function resolveClientIdForCommand(options: { clientId?: string; gateway: string }): string {
  const clientId = requireClientId(options.clientId);
  rememberSession(clientId, options.gateway);
  return clientId;
}

function printThrown(error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  console.error(text);
  for (const tip of diagnoseThrownError(error)) {
    console.error(`[diagnose] ${tip}`);
  }
  process.exitCode = 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAnyJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('JSON 解析失败');
  }
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
  if (options.connectionId?.trim()) {
    return { connectionId: options.connectionId.trim() };
  }
  if (options.clientId?.trim()) {
    return { clientId: options.clientId.trim() };
  }
  const currentClientId = getCurrentClientId();
  if (currentClientId) {
    return { clientId: currentClientId };
  }
  throw new Error('本地 test-case 需要 --connection-id，或使用已连接的当前默认会话');
}

function stringifyMaybeJson(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function flattenCloudToolCases(items: CloudSpecCase[], bucket: CloudSpecCase[] = []): CloudSpecCase[] {
  for (const item of items) {
    if (item.node_type === 'case' && item.type === 'tool_case') {
      bucket.push(item);
    }
    if (Array.isArray(item.children)) {
      flattenCloudToolCases(item.children, bucket);
    }
  }
  return bucket;
}

function normalizeCloudSavePayload(
  raw: Record<string, unknown>,
  options: { caseId?: string; parentId?: string }
): Record<string, unknown> {
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!name.trim()) throw new Error('cloud test-case 需要 name');
  const toolName = typeof raw.toolName === 'string'
    ? raw.toolName
    : typeof raw.tool_name === 'string'
      ? raw.tool_name
      : '';
  if (!toolName.trim()) throw new Error('cloud test-case 需要 toolName');
  return {
    caseId: options.caseId,
    parentId:
      typeof raw.parentId === 'string' ? raw.parentId :
      typeof raw.parent_id === 'string' ? raw.parent_id :
      options.parentId,
    nodeType: typeof raw.nodeType === 'string' ? raw.nodeType : 'case',
    type: typeof raw.type === 'string' ? raw.type : 'tool_case',
    toolName,
    name,
    input: stringifyMaybeJson(raw.input),
    output: stringifyMaybeJson(raw.expectedOutput ?? raw.output),
    description: typeof raw.description === 'string' ? raw.description : undefined
  };
}

function normalizeLocalSavePayload(
  raw: Record<string, unknown>,
  options: { caseId?: string }
): Record<string, unknown> {
  return {
    ...raw,
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : options.caseId
  };
}

// ====== Validation helpers ======

function parseTimeoutMs(raw: string | undefined): number {
  const value = raw ?? '30000';
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('--timeout-ms 必须是正整数');
  }
  return parsed;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function toToolCallErrorResponse(message: string): ToolCallResponse {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true
  };
}

function normalizeToolCallResponse(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const rawContent = value.content;
  return {
    isError: Boolean(value.isError),
    content: Array.isArray(rawContent)
      ? rawContent.map((item) => {
          if (!isRecord(item)) return { type: 'text', text: '' };
          return {
            type: typeof item.type === 'string' ? item.type : 'text',
            text: typeof item.text === 'string' ? item.text : ''
          };
        })
      : []
  };
}

function isToolCallResponseEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual == null || expected == null) return false;
  return JSON.stringify(normalizeToolCallResponse(actual)) === JSON.stringify(normalizeToolCallResponse(expected));
}

function toStoredToolTestCase(value: unknown, index: number): StoredToolTestCase | null {
  if (!isRecord(value)) return null;
  const toolName = typeof value.toolName === 'string' ? value.toolName.trim() : '';
  if (!toolName) return null;
  const now = Date.now();
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : `case_${index + 1}`;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id;
  const status = value.status;
  const normalizedStatus: ToolCaseStatus | undefined =
    status === 'pending' || status === 'passed' || status === 'failed' || status === 'running' || status === 'timeout'
      ? status
      : undefined;
  return {
    id, name, toolName,
    description: typeof value.description === 'string' ? value.description : undefined,
    input: isRecord(value.input) ? value.input : {},
    expectedOutput: value.expectedOutput,
    actualOutput: value.actualOutput,
    status: normalizedStatus,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now
  };
}

async function ensureClientConnected(bridge: MessageBridge, clientId: string) {
  const res = await bridge.commandRequest('ping', { clientId });
  if (res.code !== 200) throw new Error(`clientId 不可用：${toText(res.msg)}`);
}

async function loadStoredToolTestCases(bridge: MessageBridge, clientId: string): Promise<StoredToolTestCase[]> {
  const res = await bridge.commandRequest<LoadedToolCasesPayload>('test-cases/load', { clientId });
  if (res.code !== 200) throw new Error(`加载测试用例失败：${toText(res.msg)}`);
  const payload = res.msg;
  const rawCases = Array.isArray(payload?.testCases) ? payload.testCases : [];
  return rawCases
    .map((item, index) => toStoredToolTestCase(item, index))
    .filter((item): item is StoredToolTestCase => item !== null);
}

async function saveStoredToolTestCases(
  bridge: MessageBridge, clientId: string, testCases: StoredToolTestCase[]
): Promise<RestFulResponse> {
  return bridge.commandRequest('test-cases/save', { clientId, testCases });
}

function matchesToolCaseFilters(
  testCase: StoredToolTestCase,
  options: { toolName?: string; caseId?: string; caseName?: string }
): boolean {
  if (options.toolName && testCase.toolName !== options.toolName) return false;
  if (options.caseId && testCase.id !== options.caseId) return false;
  if (options.caseName && testCase.name !== options.caseName) return false;
  return true;
}

async function runToolValidationCase(
  bridge: MessageBridge, clientId: string, testCase: StoredToolTestCase, timeoutMs: number
): Promise<{ result: ToolValidationResult; updatedCase: StoredToolTestCase }> {
  const startedAt = Date.now();
  const hasExpectedOutput = testCase.expectedOutput !== undefined && testCase.expectedOutput !== null;
  try {
    const res = await bridge.commandRequest<ToolCallResponse>(
      'tools/call',
      { clientId, toolName: testCase.toolName, toolArgs: testCase.input },
      timeoutMs
    );
    const actualOutput = res.code === 200 ? res.msg : toToolCallErrorResponse(toText(res.msg));
    const matchedExpectedOutput = res.code === 200 && (!hasExpectedOutput || isToolCallResponseEqual(actualOutput, testCase.expectedOutput));
    const status: ToolCaseStatus = res.code === 200 ? (matchedExpectedOutput ? 'passed' : 'failed') : 'failed';
    const error = res.code === 200 ? undefined : toText(res.msg);
    const updatedCase: StoredToolTestCase = { ...testCase, actualOutput, status, updatedAt: Date.now() };
    return {
      result: { id: testCase.id, name: testCase.name, toolName: testCase.toolName, status, durationMs: Date.now() - startedAt, hasExpectedOutput, matchedExpectedOutput, actualOutput, expectedOutput: testCase.expectedOutput, error },
      updatedCase
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status: ToolCaseStatus = /timeout|timed out|ETIMEDOUT/i.test(message) ? 'timeout' : 'failed';
    const actualOutput = toToolCallErrorResponse(message);
    const updatedCase: StoredToolTestCase = { ...testCase, actualOutput, status, updatedAt: Date.now() };
    return {
      result: { id: testCase.id, name: testCase.name, toolName: testCase.toolName, status, durationMs: Date.now() - startedAt, hasExpectedOutput, matchedExpectedOutput: false, actualOutput, expectedOutput: testCase.expectedOutput, error: message },
      updatedCase
    };
  }
}

// ====== Command definition ======

export const toolCommand = new Command('tool')
  .description('MCP 工具操作与测试用例管理');

/* ── tool list ── */

gw(
  toolCommand
    .command('list')
    .description('列出 tools')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .action(async (options) => {
      try {
        const clientId = resolveClientIdForCommand(options);
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

/* ── tool call ── */

gw(
  toolCommand
    .command('call')
    .description('调用指定 tool')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .requiredOption('--name <name>', '工具名称')
    .option('-a, --args <json>', '传给工具的参数对象 JSON', '{}')
    .action(async (options) => {
      try {
        const toolArgs = parseJsonData(options.args);
        const clientId = resolveClientIdForCommand(options);
        await withGateway(options.gateway, async (bridge) => {
          const res = await bridge.commandRequest('tools/call', { clientId, toolName: options.name, toolArgs });
          printResponse('tools/call', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

/* ── tool run ── */

gw(
  toolCommand
    .command('run')
    .description('执行已保存的工具测试用例，并自动与 expectedOutput 对比')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .option('--tool-name <name>', '只执行某个工具的测试用例')
    .option('--case-id <id>', '只执行指定测试用例 ID')
    .option('--case-name <name>', '只执行指定测试用例名称（精确匹配）')
    .option('--timeout-ms <ms>', '单条用例执行超时（毫秒）', '30000')
    .action(async (options) => {
      try {
        const clientId = requireClientId(options.clientId);
        const timeoutMs = parseTimeoutMs(options.timeoutMs as string | undefined);
        rememberSession(clientId, options.gateway);

        await withGateway(options.gateway, async (bridge) => {
          await ensureClientConnected(bridge, clientId);
          const allCases = await loadStoredToolTestCases(bridge, clientId);
          const matchedCases = allCases.filter((testCase) =>
            matchesToolCaseFilters(testCase, {
              toolName: options.toolName as string | undefined,
              caseId: options.caseId as string | undefined,
              caseName: options.caseName as string | undefined
            })
          );

          if (matchedCases.length === 0) {
            printJson({
              code: 404,
              msg: '没有匹配的工具测试用例',
              data: {
                totalStoredCases: allCases.length,
                filters: { toolName: options.toolName, caseId: options.caseId, caseName: options.caseName }
              }
            });
            process.exitCode = 1;
            return;
          }

          const updatedById = new Map<string, StoredToolTestCase>();
          const results: ToolValidationResult[] = [];
          for (const testCase of matchedCases) {
            const { result, updatedCase } = await runToolValidationCase(bridge, clientId, testCase, timeoutMs);
            updatedById.set(updatedCase.id, updatedCase);
            results.push(result);
          }

          const mergedCases = allCases.map((testCase) => updatedById.get(testCase.id) ?? testCase);
          const saveRes = await saveStoredToolTestCases(bridge, clientId, mergedCases);
          const passed = results.filter((item) => item.status === 'passed').length;
          const failed = results.filter((item) => item.status === 'failed').length;
          const timeout = results.filter((item) => item.status === 'timeout').length;

          printJson({
            code: 200,
            msg: {
              mode: 'tool',
              clientId,
              total: results.length,
              passed, failed, timeout,
              filters: { toolName: options.toolName, caseId: options.caseId, caseName: options.caseName },
              writeBack: { ok: saveRes.code === 200, response: saveRes },
              results
            }
          });

          if (failed > 0 || timeout > 0 || saveRes.code !== 200) {
            process.exitCode = 1;
          }
        });
      } catch (error) {
        printThrown(error);
      }
    })
);

/* ── test-case CRUD ── */

const testCaseCmd = new Command('test-case')
  .alias('test-cases')
  .description('测试用例管理（本地/云端）');

gw(
  testCaseCmd
    .command('list')
    .description('列出测试用例')
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
            const res = await bridge.commandRequest('spec-cases/tree', { projectId });
            if (res.code !== 200) {
              printResponse('spec-cases/tree', res);
              process.exitCode = 1;
              return;
            }
            const tree = Array.isArray(res.data ?? res.msg) ? (res.data ?? res.msg) as CloudSpecCase[] : [];
            printJson({ code: 200, msg: 'ok', data: flattenCloudToolCases(tree) });
          });
          return;
        }
        await withGateway(options.gateway, async (bridge) => {
          const target = resolveLocalConnectionTarget(options);
          const res = await bridge.commandRequest('test-cases/list', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target
          });
          printResponse('test-cases/list', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

gw(
  testCaseCmd
    .command('get')
    .description('获取单个测试用例')
    .requiredOption('--case-id <id>', '测试用例 ID')
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
            const res = await bridge.commandRequest('spec-cases/get', {
              projectId, caseId: options.caseId
            });
            printResponse('spec-cases/get', res);
            if (res.code !== 200) process.exitCode = 1;
            return;
          }
          const target = resolveLocalConnectionTarget(options);
          const res = await bridge.commandRequest('test-cases/get', {
            caseId: options.caseId,
            ...toLocalScopePayload(scope, options.workspace),
            ...target
          });
          printResponse('test-cases/get', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

gw(
  testCaseCmd
    .command('save')
    .description('创建或更新测试用例')
    .option('--case-id <id>', '已有测试用例 ID；用于 update')
    .option('--parent-id <id>', 'cloud test-case 的父节点 ID')
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
            const payload = normalizeCloudSavePayload(raw, {
              caseId: options.caseId as string | undefined,
              parentId: options.parentId as string | undefined
            });
            const command = options.caseId ? 'spec-cases/update' : 'spec-cases/create';
            const res = await bridge.commandRequest(command, { projectId, ...payload });
            printResponse(command, res);
            if (res.code !== 200) process.exitCode = 1;
            return;
          }
          const target = resolveLocalConnectionTarget(options);
          const res = await bridge.commandRequest('test-cases/upsert', {
            ...toLocalScopePayload(scope, options.workspace),
            ...target,
            testCase: normalizeLocalSavePayload(raw, { caseId: options.caseId as string | undefined })
          });
          printResponse('test-cases/upsert', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

gw(
  testCaseCmd
    .command('delete')
    .description('删除测试用例')
    .requiredOption('--case-id <id>', '测试用例 ID')
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
            const res = await bridge.commandRequest('spec-cases/delete', {
              projectId, caseId: options.caseId
            });
            printResponse('spec-cases/delete', res);
            if (res.code !== 200) process.exitCode = 1;
            return;
          }
          const target = resolveLocalConnectionTarget(options);
          const res = await bridge.commandRequest('test-cases/delete', {
            caseId: options.caseId,
            ...toLocalScopePayload(scope, options.workspace),
            ...target
          });
          printResponse('test-cases/delete', res);
          if (res.code !== 200) process.exitCode = 1;
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    })
);

toolCommand.addCommand(testCaseCmd);
