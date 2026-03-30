import { Command } from 'commander';
import type { MessageBridge, RestFulResponse } from '../lib/message-bridge.js';
import { printJson, withGateway, DEFAULT_GATEWAY, parseJsonData, readJsonFile } from '../lib/cli-helpers.js';
import { HELP_VALIDATION, HELP_VALIDATION_TOOL } from '../lib/help-text.js';
import { rememberSession, requireClientId } from '../lib/mcp-session-store.js';

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

function gw(cmd: Command): Command {
  return cmd.option('-g, --gateway <url>', 'Gateway WebSocket URL', DEFAULT_GATEWAY);
}

function printThrown(error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  console.error(text);
  process.exitCode = 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTimeoutMs(raw: string | undefined): number {
  const value = raw ?? '30000';
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('--timeout-ms 必须是正整数');
  }
  return parsed;
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toToolCallErrorResponse(message: string): ToolCallResponse {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true
  };
}

function normalizeToolCallResponse(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const rawContent = value.content;
  return {
    isError: Boolean(value.isError),
    content: Array.isArray(rawContent)
      ? rawContent.map((item) => {
          if (!isRecord(item)) {
            return { type: 'text', text: '' };
          }
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
  if (!isRecord(value)) {
    return null;
  }
  const toolName = typeof value.toolName === 'string' ? value.toolName.trim() : '';
  if (!toolName) {
    return null;
  }
  const now = Date.now();
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : `case_${index + 1}`;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id;
  const status = value.status;
  const normalizedStatus: ToolCaseStatus | undefined =
    status === 'pending' || status === 'passed' || status === 'failed' || status === 'running' || status === 'timeout'
      ? status
      : undefined;
  return {
    id,
    name,
    toolName,
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
  if (res.code !== 200) {
    throw new Error(`clientId 不可用：${toText(res.msg)}`);
  }
}

async function loadStoredToolTestCases(bridge: MessageBridge, clientId: string): Promise<StoredToolTestCase[]> {
  const res = await bridge.commandRequest<LoadedToolCasesPayload>('test-cases/load', { clientId });
  if (res.code !== 200) {
    throw new Error(`加载测试用例失败：${toText(res.msg)}`);
  }
  const payload = res.msg;
  const rawCases = Array.isArray(payload?.testCases) ? payload.testCases : [];
  return rawCases
    .map((item, index) => toStoredToolTestCase(item, index))
    .filter((item): item is StoredToolTestCase => item !== null);
}

async function saveStoredToolTestCases(
  bridge: MessageBridge,
  clientId: string,
  testCases: StoredToolTestCase[]
): Promise<RestFulResponse> {
  return bridge.commandRequest('test-cases/save', { clientId, testCases });
}

function matchesToolCaseFilters(
  testCase: StoredToolTestCase,
  options: { toolName?: string; caseId?: string; caseName?: string }
): boolean {
  if (options.toolName && testCase.toolName !== options.toolName) {
    return false;
  }
  if (options.caseId && testCase.id !== options.caseId) {
    return false;
  }
  if (options.caseName && testCase.name !== options.caseName) {
    return false;
  }
  return true;
}

async function runToolValidationCase(
  bridge: MessageBridge,
  clientId: string,
  testCase: StoredToolTestCase,
  timeoutMs: number
): Promise<{ result: ToolValidationResult; updatedCase: StoredToolTestCase }> {
  const startedAt = Date.now();
  const hasExpectedOutput = testCase.expectedOutput !== undefined && testCase.expectedOutput !== null;
  try {
    const res = await bridge.commandRequest<ToolCallResponse>(
      'tools/call',
      {
        clientId,
        toolName: testCase.toolName,
        toolArgs: testCase.input
      },
      timeoutMs
    );

    const actualOutput = res.code === 200 ? res.msg : toToolCallErrorResponse(toText(res.msg));
    const matchedExpectedOutput = res.code === 200 && (!hasExpectedOutput || isToolCallResponseEqual(actualOutput, testCase.expectedOutput));
    const status: ToolCaseStatus = res.code === 200 ? (matchedExpectedOutput ? 'passed' : 'failed') : 'failed';
    const error = res.code === 200 ? undefined : toText(res.msg);
    const updatedCase: StoredToolTestCase = {
      ...testCase,
      actualOutput,
      status,
      updatedAt: Date.now()
    };

    return {
      result: {
        id: testCase.id,
        name: testCase.name,
        toolName: testCase.toolName,
        status,
        durationMs: Date.now() - startedAt,
        hasExpectedOutput,
        matchedExpectedOutput,
        actualOutput,
        expectedOutput: testCase.expectedOutput,
        error
      },
      updatedCase
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status: ToolCaseStatus = /timeout|timed out|ETIMEDOUT/i.test(message) ? 'timeout' : 'failed';
    const actualOutput = toToolCallErrorResponse(message);
    const updatedCase: StoredToolTestCase = {
      ...testCase,
      actualOutput,
      status,
      updatedAt: Date.now()
    };

    return {
      result: {
        id: testCase.id,
        name: testCase.name,
        toolName: testCase.toolName,
        status,
        durationMs: Date.now() - startedAt,
        hasExpectedOutput,
        matchedExpectedOutput: false,
        actualOutput,
        expectedOutput: testCase.expectedOutput,
        error: message
      },
      updatedCase
    };
  }
}

export const validationCmd = new Command('validation')
  .description('测试与验证入口：执行已保存的工具测试用例，或运行批量验证。')
  .addHelpText('after', HELP_VALIDATION);

gw(
  validationCmd
    .command('tool')
    .description('执行已保存的工具测试用例，并自动与 expectedOutput 对比')
    .option('--client-id <id>', 'clientId；不传则使用当前默认会话')
    .option('--tool-name <name>', '只执行某个工具的测试用例')
    .option('--case-id <id>', '只执行指定测试用例 ID')
    .option('--case-name <name>', '只执行指定测试用例名称（精确匹配）')
    .option('--timeout-ms <ms>', '单条用例执行超时（毫秒）', '30000')
    .addHelpText('after', HELP_VALIDATION_TOOL)
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
              msg: '没有匹配的工具测试用例；请先在 Web UI 中保存测试用例，或调整筛选条件。',
              data: {
                totalStoredCases: allCases.length,
                filters: {
                  toolName: options.toolName,
                  caseId: options.caseId,
                  caseName: options.caseName
                }
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
              passed,
              failed,
              timeout,
              filters: {
                toolName: options.toolName,
                caseId: options.caseId,
                caseName: options.caseName
              },
              writeBack: {
                ok: saveRes.code === 200,
                response: saveRes
              },
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

gw(
  validationCmd
    .command('batch')
    .description('执行批量验证（底层调用 batch-validation/run，请求体大时务必用 -f）')
    .option('-f, --file <path>', '完整请求 JSON：messages、testCases、llmConfig 等')
    .option('-d, --data <json>', '内联 JSON（较少用）')
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
        printThrown(error);
      }
    })
);
