import { ref } from 'vue';
import { useMessageBridge } from '@/api/message-bridge';
import type { TestCase } from '../../tools';
import { cloudContext } from '@/hook/cloud-context';
import { isCloudLoggedIn } from '@/hook/cloud-auth';
import {
    cloudCreateSpecCase,
    cloudDeleteSpecCase,
    cloudGetSpecCaseTree,
    cloudUpdateSpecCase,
    type CloudSpecCase
} from '@/api/cloud';

let currentClient: any | null = null;
const EXCLUDED_SPEC_CASE_TYPES = new Set(['batch-validation', 'batch_validation']);
const NON_TOOL_CASE_TYPES = new Set(['group', 'prompt', 'prompt_case']);
const TOOL_CASE_TYPES = new Set(['tool_case', 'tool']);

export const testCasesState = ref<TestCase[]>([]);

export function initTestCasesStore(client: any) {
    currentClient = client;
    loadTestCases();
}

function inCloudMode(): boolean {
    return cloudContext.mode === 'cloud' && isCloudLoggedIn.value && !!cloudContext.currentProjectId;
}

function toCloudPayload(testCase: Partial<TestCase>) {
    const payload: Parameters<typeof cloudCreateSpecCase>[1] = {
        node_type: 'case' as const,
        type: 'tool_case',
        tool_name: testCase.toolName || '',
        name: testCase.name || 'Untitled',
        input: JSON.stringify(testCase.input ?? {}),
        description: testCase.description ?? ''
    };
    if (testCase.expectedOutput !== undefined && testCase.expectedOutput !== null) {
        payload.output = JSON.stringify(testCase.expectedOutput);
    }
    return payload;
}

function mapCloudNodeToTestCase(node: CloudSpecCase): TestCase {
    let input: Record<string, any> = {};
    let expectedOutput: any = undefined;
    let description = typeof node.description === 'string' ? node.description : '';
    const legacyType = typeof node.type === 'string' ? node.type.trim() : '';
    const normalizedType = TOOL_CASE_TYPES.has(legacyType) ? 'tool_case' : legacyType;
    const toolName = typeof node.tool_name === 'string' && node.tool_name.trim() !== ''
        ? node.tool_name.trim()
        : (!EXCLUDED_SPEC_CASE_TYPES.has(normalizedType) && normalizedType !== '' && normalizedType !== 'tool_case'
            ? normalizedType
            : '');

    const rawInput = node.input;
    if (rawInput != null && String(rawInput).trim() !== '') {
        try {
            input = JSON.parse(String(rawInput));
        } catch {
            input = {};
        }
    }

    const rawOut = node.output;
    if (rawOut != null && String(rawOut).trim() !== '') {
        try {
            const parsedOutput = JSON.parse(String(rawOut));
            if (
                parsedOutput &&
                typeof parsedOutput === 'object' &&
                !Array.isArray(parsedOutput) &&
                ('expectedOutput' in parsedOutput || 'description' in parsedOutput)
            ) {
                expectedOutput = (parsedOutput as { expectedOutput?: unknown }).expectedOutput;
                if (description === '') {
                    const leg = (parsedOutput as { description?: unknown }).description;
                    if (typeof leg === 'string') {
                        description = leg;
                    }
                }
            } else {
                expectedOutput = parsedOutput;
            }
        } catch {
            expectedOutput = undefined;
        }
    }

    const createdAt = typeof (node as any).created_at === 'string'
        ? Date.parse((node as any).created_at) || Date.now()
        : Date.now();
    const updatedAt = typeof (node as any).updated_at === 'string'
        ? Date.parse((node as any).updated_at) || createdAt
        : createdAt;
    return {
        id: node.id,
        name: node.name,
        description,
        toolName,
        input,
        expectedOutput,
        status: 'pending',
        createdAt,
        updatedAt
    };
}

function isCloudToolCase(node: CloudSpecCase): boolean {
    const rawType = typeof node.type === 'string' ? node.type.trim() : '';
    if (EXCLUDED_SPEC_CASE_TYPES.has(rawType) || NON_TOOL_CASE_TYPES.has(rawType)) {
        return false;
    }
    return true;
}

function flattenCloudCases(nodes: CloudSpecCase[]): TestCase[] {
    const cases: TestCase[] = [];
    const walk = (items: CloudSpecCase[]) => {
        for (const item of items) {
            if (item.node_type === 'case' && isCloudToolCase(item)) {
                cases.push(mapCloudNodeToTestCase(item));
            }
            if (item.children && item.children.length > 0) {
                walk(item.children);
            }
        }
    };
    walk(nodes);
    return cases;
}

function getClientId(): string {
    if (!currentClient) throw new Error('Test cases store not initialized');
    return currentClient.clientId;
}

export async function saveTestCases() {
    if (inCloudMode()) {
        return;
    }
    if (!currentClient) return;
    const bridge = useMessageBridge();
    await bridge.commandRequest('test-cases/save', {
        clientId: getClientId(),
        testCases: testCasesState.value
    });
}

export async function loadTestCases() {
    // 云端模式：须等 auth/status 完成后再拉树。若在已选项目但尚未登录时走本地 load，会用空文件覆盖云端列表且之后不会自动重拉。
    if (cloudContext.mode === 'cloud') {
        if (!cloudContext.currentProjectId) {
            testCasesState.value = [];
            return;
        }
        if (!isCloudLoggedIn.value) {
            return;
        }
        const tree = await cloudGetSpecCaseTree(cloudContext.currentProjectId);
        testCasesState.value = flattenCloudCases(tree);
        return;
    }
    if (!currentClient) return;
    const bridge = useMessageBridge();
    const { code, msg } = await bridge.commandRequest<{ testCases: TestCase[] }>('test-cases/load', {
        clientId: getClientId()
    });
    if (code === 200 && msg?.testCases) {
        testCasesState.value = msg.testCases;
    }
}

export async function createTestCase(testCase: TestCase) {
    if (inCloudMode()) {
        const created = await cloudCreateSpecCase(cloudContext.currentProjectId, toCloudPayload(testCase));
        testCasesState.value = [...testCasesState.value, mapCloudNodeToTestCase(created)];
        return;
    }
    testCasesState.value = [...testCasesState.value, testCase];
    await saveTestCases();
}

export async function updateTestCase(id: string, patch: Partial<TestCase>, options?: { persist?: boolean }) {
    testCasesState.value = testCasesState.value.map(tc => tc.id === id ? { ...tc, ...patch } : tc);
    if (options?.persist === false) {
        return;
    }
    if (inCloudMode()) {
        const current = testCasesState.value.find(tc => tc.id === id);
        if (!current) {
            return;
        }
        const row = await cloudUpdateSpecCase(cloudContext.currentProjectId, id, toCloudPayload(current));
        const mapped = mapCloudNodeToTestCase(row);
        testCasesState.value = testCasesState.value.map(tc =>
            tc.id === id
                ? {
                      ...mapped,
                      status: tc.status,
                      actualOutput: tc.actualOutput
                  }
                : tc
        );
        return;
    }
    await saveTestCases();
}

export async function deleteTestCase(id: string) {
    testCasesState.value = testCasesState.value.filter(tc => tc.id !== id);
    if (inCloudMode()) {
        await cloudDeleteSpecCase(cloudContext.currentProjectId, id);
        return;
    }
    await saveTestCases();
}
