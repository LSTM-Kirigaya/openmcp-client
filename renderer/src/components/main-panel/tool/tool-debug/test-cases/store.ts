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

export const testCasesState = ref<TestCase[]>([]);

export function initTestCasesStore(client: any) {
    currentClient = client;
    loadTestCases();
}

function inCloudMode(): boolean {
    return cloudContext.mode === 'cloud';
}

function toCloudPayload(testCase: Partial<TestCase>) {
    return {
        node_type: 'case' as const,
        type: testCase.toolName || 'tool',
        name: testCase.name || 'Untitled',
        input: JSON.stringify(testCase.input ?? {}),
        output: testCase.expectedOutput !== undefined
            ? JSON.stringify(testCase.expectedOutput)
            : ''
    };
}

function mapCloudNodeToTestCase(node: CloudSpecCase): TestCase {
    let input: Record<string, any> = {};
    let expectedOutput: any = undefined;

    try {
        input = node.input ? JSON.parse(node.input) : {};
    } catch {
        input = {};
    }

    try {
        expectedOutput = node.output ? JSON.parse(node.output) : undefined;
    } catch {
        expectedOutput = undefined;
    }

    const now = Date.now();
    return {
        id: node.id,
        name: node.name,
        toolName: node.type || '',
        input,
        expectedOutput,
        status: 'pending',
        createdAt: now,
        updatedAt: now
    };
}

function flattenCloudCases(nodes: CloudSpecCase[]): TestCase[] {
    const cases: TestCase[] = [];
    const walk = (items: CloudSpecCase[]) => {
        for (const item of items) {
            if (item.node_type === 'case') {
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
        if (!isCloudLoggedIn.value || !cloudContext.currentProjectId) {
            testCasesState.value = [];
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
        if (!isCloudLoggedIn.value || !cloudContext.currentProjectId) {
            return;
        }
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
        if (!isCloudLoggedIn.value || !cloudContext.currentProjectId) {
            return;
        }
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
        if (!isCloudLoggedIn.value || !cloudContext.currentProjectId) {
            return;
        }
        await cloudDeleteSpecCase(cloudContext.currentProjectId, id);
        return;
    }
    await saveTestCases();
}
