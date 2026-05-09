import * as crypto from 'crypto';
import * as fs from 'fs';
import type { LocalStorageScopeOptions } from './paths.js';
import { ensureParentDir, getLegacyServerDataCandidates, getToolCasesPath } from './paths.js';

export interface StoredToolTestCase {
    id: string;
    name: string;
    toolName: string;
    description?: string;
    input: Record<string, any>;
    expectedOutput?: any;
    actualOutput?: any;
    status?: 'pending' | 'passed' | 'failed' | 'running' | 'timeout';
    createdAt: number;
    updatedAt: number;
    [key: string]: any;
}

interface ToolCasesFile {
    version: 1;
    testCases: StoredToolTestCase[];
}

const EMPTY_FILE: ToolCasesFile = {
    version: 1,
    testCases: []
};

function readJsonFile<T>(filePath: string): T | undefined {
    try {
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
        return undefined;
    }
}

function cloneValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeToolCase(value: unknown, index: number): StoredToolTestCase | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const row = cloneValue(value as Record<string, any>);
    const toolName = typeof row.toolName === 'string' ? row.toolName.trim() : '';
    if (!toolName) {
        return null;
    }
    const now = Date.now() + index;
    return {
        id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : crypto.randomUUID(),
        name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : `Test Case ${index + 1}`,
        toolName,
        description: typeof row.description === 'string' ? row.description : undefined,
        input: row.input && typeof row.input === 'object' && !Array.isArray(row.input) ? row.input : {},
        expectedOutput: row.expectedOutput,
        actualOutput: row.actualOutput,
        status:
            row.status === 'pending' ||
            row.status === 'passed' ||
            row.status === 'failed' ||
            row.status === 'running' ||
            row.status === 'timeout'
                ? row.status
                : undefined,
        createdAt: typeof row.createdAt === 'number' ? row.createdAt : now,
        updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : now,
        ...row
    };
}

function writeFile(filePath: string, data: ToolCasesFile): void {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function migrateLegacyFile(connectionKey: string, options: LocalStorageScopeOptions): ToolCasesFile | undefined {
    for (const candidate of getLegacyServerDataCandidates(connectionKey, options)) {
        const legacy = readJsonFile<{ testCases?: unknown[] }>(candidate);
        if (!legacy || !Array.isArray(legacy.testCases)) {
            continue;
        }
        return {
            version: 1,
            testCases: legacy.testCases
                .map((item, index) => normalizeToolCase(item, index))
                .filter((item): item is StoredToolTestCase => item !== null)
        };
    }
    return undefined;
}

function loadFile(connectionKey: string, options: LocalStorageScopeOptions = {}): ToolCasesFile {
    const filePath = getToolCasesPath(connectionKey, options);
    const existing = readJsonFile<ToolCasesFile>(filePath);
    if (existing && Array.isArray(existing.testCases)) {
        return {
            version: 1,
            testCases: existing.testCases
                .map((item, index) => normalizeToolCase(item, index))
                .filter((item): item is StoredToolTestCase => item !== null)
        };
    }
    const migrated = migrateLegacyFile(connectionKey, options);
    if (migrated) {
        writeFile(filePath, migrated);
        return migrated;
    }
    return cloneValue(EMPTY_FILE);
}

function saveFile(connectionKey: string, options: LocalStorageScopeOptions, data: ToolCasesFile): void {
    writeFile(getToolCasesPath(connectionKey, options), data);
}

export function listStoredToolCases(connectionKey: string, options: LocalStorageScopeOptions = {}): StoredToolTestCase[] {
    return loadFile(connectionKey, options).testCases;
}

export function getStoredToolCase(
    connectionKey: string,
    caseId: string,
    options: LocalStorageScopeOptions = {}
): StoredToolTestCase | undefined {
    return loadFile(connectionKey, options).testCases.find((item) => item.id === caseId);
}

export function replaceStoredToolCases(
    connectionKey: string,
    testCases: StoredToolTestCase[],
    options: LocalStorageScopeOptions = {}
): void {
    saveFile(connectionKey, options, {
        version: 1,
        testCases: testCases
            .map((item, index) => normalizeToolCase(item, index))
            .filter((item): item is StoredToolTestCase => item !== null)
    });
}

export function upsertStoredToolCase(
    connectionKey: string,
    testCase: Partial<StoredToolTestCase>,
    options: LocalStorageScopeOptions = {}
): StoredToolTestCase {
    const file = loadFile(connectionKey, options);
    const normalized = normalizeToolCase(
        {
            ...testCase,
            id: testCase.id || crypto.randomUUID(),
            updatedAt: Date.now(),
            createdAt: testCase.createdAt || Date.now()
        },
        file.testCases.length
    );
    if (!normalized) {
        throw new Error('无效的测试用例：至少需要 toolName');
    }
    const index = file.testCases.findIndex((item) => item.id === normalized.id);
    if (index >= 0) {
        normalized.createdAt = file.testCases[index].createdAt;
        file.testCases[index] = normalized;
    } else {
        file.testCases.unshift(normalized);
    }
    saveFile(connectionKey, options, file);
    return normalized;
}

export function deleteStoredToolCase(
    connectionKey: string,
    caseId: string,
    options: LocalStorageScopeOptions = {}
): boolean {
    const file = loadFile(connectionKey, options);
    const nextCases = file.testCases.filter((item) => item.id !== caseId);
    if (nextCases.length === file.testCases.length) {
        return false;
    }
    saveFile(connectionKey, options, {
        version: 1,
        testCases: nextCases
    });
    return true;
}

export function getStoredToolCasesPath(connectionKey: string, options: LocalStorageScopeOptions = {}): string {
    return getToolCasesPath(connectionKey, options);
}
