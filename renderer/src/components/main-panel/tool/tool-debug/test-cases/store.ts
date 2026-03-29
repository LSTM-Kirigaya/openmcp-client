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
const EXCLUDED_SPEC_CASE_TYPES = new Set(['batch-validation']);

export const testCasesState = ref<TestCase[]>([]);

export function initTestCasesStore(client: any) {
    currentClient = client;
    loadTestCases();
}

function inCloudMode(): boolean {
    return cloudContext.mode === 'cloud' && isCloudLoggedIn.value && !!cloudContext.currentProjectId;
}

function toCloudPayload(testCase: Partial<TestCase>) {
    const outputPayload = {
        expectedOutput: testCase.expectedOutput,
        description: testCase.description ?? ''
    };
    return {
        node_type: 'case' as const,
        type: testCase.toolName || 'tool',
        name: testCase.name || 'Untitled',
        input: JSON.stringify(testCase.input ?? {}),
        output: JSON.stringify(outputPayload)
    };
}

function mapCloudNodeToTestCase(node: CloudSpecCase): TestCase {
    let input: Record<string, any> = {};
    let expectedOutput: any = undefined;
    let description = '';

    try {
        input = node.input ? JSON.parse(node.input) : {};
    } catch {
        input = {};
    }

    try {
        const parsedOutput = node.output ? JSON.parse(node.output) : undefined;
        if (
            parsedOutput &&
            typeof parsedOutput === 'object' &&
            ('expectedOutput' in parsedOutput || 'description' in parsedOutput)
        ) {
            expectedOutput = (parsedOutput as any).expectedOutput;
            description = typeof (parsedOutput as any).description === 'string'
                ? (parsedOutput as any).description
                : '';
        } else {
            // backward compatibility: old output stores expectedOutput directly
            expectedOutput = parsedOutput;
        }
    } catch {
        expectedOutput = undefined;
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
        toolName: node.type || '',
        input,
        expectedOutput,
        status: 'pending',
        createdAt,
        updatedAt
    };
}

function flattenCloudCases(nodes: CloudSpecCase[]): TestCase[] {
    const cases: TestCase[] = [];
    const walk = (items: CloudSpecCase[]) => {
        for (const item of items) {
            if (item.node_type === 'case' && !EXCLUDED_SPEC_CASE_TYPES.has(item.type || '')) {
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
    if (inCloudMode()) {
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
        await cloudUpdateSpecCase(cloudContext.currentProjectId, id, toCloudPayload(current));
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
