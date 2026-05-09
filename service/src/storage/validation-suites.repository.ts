import * as fs from 'fs';
import * as path from 'path';
import type { LocalStorageScopeOptions } from './paths.js';
import {
    ensureParentDir,
    ensureStorageDir,
    getLegacyBatchValidationDirCandidates,
    getValidationSuiteFilePath,
    getValidationSuitesDir,
    getValidationSuitesIndexPath
} from './paths.js';

const DEFAULT_SUITE_ID = 'default';
const DEFAULT_SUITE_NAME = 'Default Validation Suite';

export interface ValidationSuiteSummary {
    id: string;
    name: string;
    description: string;
    createdAt: number;
    updatedAt: number;
}

export interface BatchValidationStorageRow {
    testCases: Array<{
        id: string;
        name?: string;
        description?: string;
        input: string;
        inputRichContent?: Array<{ type: string; text: string; name?: string; args?: Record<string, string> }>;
        criteria: string[];
    }>;
    selectedCaseIndex: number;
    comprehensiveSelectedIndices: number[];
    comprehensivePresets: Array<{ id: string; name: string; indices: number[] }>;
    currentPresetId?: string;
    sourceTabIndex: number;
    evaluationMode: 'pass-fail' | 'score';
    resultGroups: Array<{
        testCaseIndex: number;
        testInput: string;
        inputRichContent?: Array<{ type: string; text: string; name?: string; args?: Record<string, string> }>;
        agentMessages?: any[];
        agentLoopStats?: {
            durationMs: number;
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            toolCallCount: number;
        };
        criterionResults: Array<{
            testCaseId: string;
            testCaseIndex: number;
            criterionIndex: number;
            testInput: string;
            testCaseCriteria: string;
            rawResponse: string;
            pass?: boolean;
            reason?: string;
            score?: number;
            error?: string;
            evalInputTokens?: number;
            evalOutputTokens?: number;
        }>;
    }>;
}

export interface ValidationSuiteRecord extends ValidationSuiteSummary {
    storage: BatchValidationStorageRow;
}

interface ValidationSuiteIndexFile {
    version: 1;
    suites: ValidationSuiteSummary[];
}

const DEFAULT_STORAGE: BatchValidationStorageRow = {
    testCases: [],
    selectedCaseIndex: 0,
    comprehensiveSelectedIndices: [],
    comprehensivePresets: [],
    sourceTabIndex: 0,
    evaluationMode: 'pass-fail',
    resultGroups: []
};

const DEFAULT_INDEX: ValidationSuiteIndexFile = {
    version: 1,
    suites: []
};

interface BatchValidationMeta {
    cases: Array<{
        id: string;
        filename: string;
        name: string;
        description: string;
        createdAt: number;
        updatedAt: number;
    }>;
    selectedCaseIndex: number;
    comprehensiveSelectedIndices: number[];
    comprehensivePresets: Array<{ id: string; name: string; indices: number[] }>;
    currentPresetId?: string;
    sourceTabIndex: number;
    evaluationMode: 'pass-fail' | 'score';
}

interface LegacyCaseFileRow {
    id: string;
    name?: string;
    description?: string;
    input: string;
    inputRichContent?: Array<{ type: string; text: string; name?: string; args?: Record<string, string> }>;
    criteria: string[];
    lastResultGroup?: BatchValidationStorageRow['resultGroups'][0];
}

function cloneValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

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

function writeJsonFile(filePath: string, value: unknown): void {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function normalizeStorage(storage?: Partial<BatchValidationStorageRow>): BatchValidationStorageRow {
    return {
        testCases: Array.isArray(storage?.testCases) ? storage!.testCases : [],
        selectedCaseIndex: typeof storage?.selectedCaseIndex === 'number' ? storage.selectedCaseIndex : 0,
        comprehensiveSelectedIndices: Array.isArray(storage?.comprehensiveSelectedIndices)
            ? storage!.comprehensiveSelectedIndices
            : [],
        comprehensivePresets: Array.isArray(storage?.comprehensivePresets) ? storage!.comprehensivePresets : [],
        currentPresetId: typeof storage?.currentPresetId === 'string' ? storage.currentPresetId : undefined,
        sourceTabIndex: typeof storage?.sourceTabIndex === 'number' ? storage.sourceTabIndex : 0,
        evaluationMode: storage?.evaluationMode === 'score' ? 'score' : 'pass-fail',
        resultGroups: Array.isArray(storage?.resultGroups) ? storage!.resultGroups : []
    };
}

function loadIndex(connectionKey: string, options: LocalStorageScopeOptions = {}): ValidationSuiteIndexFile {
    const filePath = getValidationSuitesIndexPath(connectionKey, options);
    const existing = readJsonFile<ValidationSuiteIndexFile>(filePath);
    if (!existing || !Array.isArray(existing.suites)) {
        return cloneValue(DEFAULT_INDEX);
    }
    return {
        version: 1,
        suites: existing.suites.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
    };
}

function saveIndex(connectionKey: string, data: ValidationSuiteIndexFile, options: LocalStorageScopeOptions = {}): void {
    writeJsonFile(getValidationSuitesIndexPath(connectionKey, options), data);
}

function suiteFilePath(connectionKey: string, suiteId: string, options: LocalStorageScopeOptions = {}): string {
    return getValidationSuiteFilePath(connectionKey, suiteId, options);
}

function loadSuiteFile(
    connectionKey: string,
    suiteId: string,
    options: LocalStorageScopeOptions = {}
): ValidationSuiteRecord | undefined {
    const file = readJsonFile<ValidationSuiteRecord>(suiteFilePath(connectionKey, suiteId, options));
    if (!file || typeof file.id !== 'string' || typeof file.name !== 'string') {
        return undefined;
    }
    return {
        id: file.id,
        name: file.name,
        description: typeof file.description === 'string' ? file.description : '',
        createdAt: typeof file.createdAt === 'number' ? file.createdAt : Date.now(),
        updatedAt: typeof file.updatedAt === 'number' ? file.updatedAt : Date.now(),
        storage: normalizeStorage(file.storage)
    };
}

function saveSuiteFile(connectionKey: string, suite: ValidationSuiteRecord, options: LocalStorageScopeOptions = {}): void {
    writeJsonFile(suiteFilePath(connectionKey, suite.id, options), {
        ...suite,
        storage: normalizeStorage(suite.storage)
    });
}

function upsertIndexSummary(
    connectionKey: string,
    summary: ValidationSuiteSummary,
    options: LocalStorageScopeOptions = {}
): void {
    const index = loadIndex(connectionKey, options);
    const suiteIndex = index.suites.findIndex((item) => item.id === summary.id);
    if (suiteIndex >= 0) {
        index.suites[suiteIndex] = summary;
    } else {
        index.suites.unshift(summary);
    }
    saveIndex(connectionKey, index, options);
}

function deleteIndexSummary(connectionKey: string, suiteId: string, options: LocalStorageScopeOptions = {}): void {
    const index = loadIndex(connectionKey, options);
    saveIndex(connectionKey, {
        version: 1,
        suites: index.suites.filter((item) => item.id !== suiteId)
    }, options);
}

function loadLegacyStorageFromDir(baseDir: string): BatchValidationStorageRow | undefined {
    const metaPath = path.join(baseDir, 'meta.json');
    const meta = readJsonFile<BatchValidationMeta>(metaPath);
    if (meta) {
        const testCases: BatchValidationStorageRow['testCases'] = [];
        const resultGroups: BatchValidationStorageRow['resultGroups'] = [];
        for (const entry of meta.cases || []) {
            const caseData = readJsonFile<LegacyCaseFileRow>(path.join(baseDir, entry.filename));
            if (!caseData) continue;
            testCases.push({
                id: caseData.id,
                name: caseData.name ?? entry.name,
                description: caseData.description ?? entry.description,
                input: caseData.input ?? '',
                inputRichContent: caseData.inputRichContent,
                criteria: Array.isArray(caseData.criteria) ? caseData.criteria : []
            });
            if (caseData.lastResultGroup) {
                resultGroups.push(caseData.lastResultGroup);
            } else {
                resultGroups.push({
                    testCaseIndex: resultGroups.length,
                    testInput: caseData.input ?? '',
                    inputRichContent: caseData.inputRichContent,
                    criterionResults: []
                });
            }
        }
        return normalizeStorage({
            testCases,
            selectedCaseIndex: meta.selectedCaseIndex,
            comprehensiveSelectedIndices: meta.comprehensiveSelectedIndices,
            comprehensivePresets: meta.comprehensivePresets,
            currentPresetId: meta.currentPresetId,
            sourceTabIndex: meta.sourceTabIndex,
            evaluationMode: meta.evaluationMode,
            resultGroups
        });
    }

    const legacyConfigPath = path.join(baseDir, 'config.json');
    const direct = readJsonFile<BatchValidationStorageRow>(legacyConfigPath);
    if (direct && (Array.isArray(direct.testCases) || Array.isArray(direct.resultGroups))) {
        return normalizeStorage(direct);
    }

    if (!fs.existsSync(legacyConfigPath)) {
        return undefined;
    }

    try {
        const raw = fs.readFileSync(legacyConfigPath, 'utf-8');
        const lines = raw.split('\n').filter((s) => s.trim());
        let latest: BatchValidationStorageRow | null = null;
        let latestTs = 0;
        for (const line of lines) {
            try {
                const row = JSON.parse(line) as { id?: string; data?: BatchValidationStorageRow; timestamp?: number };
                if (row.id === 'config' && row.data && (row.timestamp ?? 0) >= latestTs) {
                    latest = row.data;
                    latestTs = row.timestamp ?? 0;
                }
            } catch {
                // ignore invalid line
            }
        }
        return latest ? normalizeStorage(latest) : undefined;
    } catch {
        return undefined;
    }
}

function migrateLegacyDefaultSuite(
    connectionKey: string,
    options: LocalStorageScopeOptions = {}
): ValidationSuiteRecord | undefined {
    for (const candidate of getLegacyBatchValidationDirCandidates(connectionKey, options)) {
        const storage = loadLegacyStorageFromDir(candidate);
        if (!storage) {
            continue;
        }
        const now = Date.now();
        const suite: ValidationSuiteRecord = {
            id: DEFAULT_SUITE_ID,
            name: DEFAULT_SUITE_NAME,
            description: '',
            createdAt: now,
            updatedAt: now,
            storage
        };
        upsertValidationSuite(connectionKey, suite, options);
        return suite;
    }
    return undefined;
}

export function listValidationSuites(
    connectionKey: string,
    options: LocalStorageScopeOptions = {}
): ValidationSuiteSummary[] {
    const index = loadIndex(connectionKey, options);
    if (index.suites.length > 0) {
        return index.suites;
    }
    const migrated = migrateLegacyDefaultSuite(connectionKey, options);
    if (migrated) {
        return [toSuiteSummary(migrated)];
    }
    return [];
}

export function getValidationSuite(
    connectionKey: string,
    suiteId: string,
    options: LocalStorageScopeOptions = {}
): ValidationSuiteRecord | undefined {
    const suite = loadSuiteFile(connectionKey, suiteId, options);
    if (suite) {
        return suite;
    }
    if (suiteId === DEFAULT_SUITE_ID) {
        return migrateLegacyDefaultSuite(connectionKey, options);
    }
    return undefined;
}

export function upsertValidationSuite(
    connectionKey: string,
    suite: Partial<ValidationSuiteRecord>,
    options: LocalStorageScopeOptions = {}
): ValidationSuiteRecord {
    ensureStorageDir(getValidationSuitesDir(connectionKey, options));
    const previous = suite.id ? loadSuiteFile(connectionKey, suite.id, options) : undefined;
    const now = Date.now();
    const next: ValidationSuiteRecord = {
        id: suite.id || previous?.id || DEFAULT_SUITE_ID,
        name: suite.name?.trim() || previous?.name || DEFAULT_SUITE_NAME,
        description: suite.description ?? previous?.description ?? '',
        createdAt: previous?.createdAt || suite.createdAt || now,
        updatedAt: now,
        storage: normalizeStorage(suite.storage ?? previous?.storage ?? DEFAULT_STORAGE)
    };
    saveSuiteFile(connectionKey, next, options);
    upsertIndexSummary(connectionKey, toSuiteSummary(next), options);
    return next;
}

export function deleteValidationSuite(
    connectionKey: string,
    suiteId: string,
    options: LocalStorageScopeOptions = {}
): boolean {
    const filePath = suiteFilePath(connectionKey, suiteId, options);
    if (!fs.existsSync(filePath)) {
        return false;
    }
    fs.unlinkSync(filePath);
    deleteIndexSummary(connectionKey, suiteId, options);
    return true;
}

export function loadDefaultValidationSuiteStorage(
    connectionKey: string,
    options: LocalStorageScopeOptions = {}
): BatchValidationStorageRow {
    const suite = getValidationSuite(connectionKey, DEFAULT_SUITE_ID, options);
    return normalizeStorage(suite?.storage ?? DEFAULT_STORAGE);
}

export function saveDefaultValidationSuiteStorage(
    connectionKey: string,
    storage: BatchValidationStorageRow,
    options: LocalStorageScopeOptions = {}
): ValidationSuiteRecord {
    return upsertValidationSuite(connectionKey, {
        id: DEFAULT_SUITE_ID,
        name: DEFAULT_SUITE_NAME,
        storage
    }, options);
}

function toSuiteSummary(suite: ValidationSuiteRecord): ValidationSuiteSummary {
    return {
        id: suite.id,
        name: suite.name,
        description: suite.description,
        createdAt: suite.createdAt,
        updatedAt: suite.updatedAt
    };
}
