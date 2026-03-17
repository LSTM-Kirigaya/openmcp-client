import * as path from 'path';
import * as fs from 'fs';
import { VSCODE_WORKSPACE } from '../hook/setting.js';

/** 将 MCP 服务器名转为安全文件名 */
function escapeServerName(name: string): string {
    return (name || 'default').replace(/[\\/:*?"<>|]/g, '_');
}

const META_FILE = 'meta.json';
const CASE_FILE_PREFIX = 'case_';
const CASE_FILE_SUFFIX = '.json';

/** meta.json 中单个用例的索引信息 */
export interface CaseMetaEntry {
    id: string;
    filename: string;
    name: string;
    description: string;
    createdAt: number;
    updatedAt: number;
}

/** meta.json 结构 */
export interface BatchValidationMeta {
    cases: CaseMetaEntry[];
    selectedCaseIndex: number;
    comprehensiveSelectedIndices: number[];
    comprehensivePresets: Array<{ id: string; name: string; indices: number[] }>;
    currentPresetId?: string;
    sourceTabIndex: number;
    evaluationMode: 'pass-fail' | 'score';
}

/** 与 renderer 侧 BatchValidationStorage 结构一致 */
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

/** 单个用例文件的完整结构（含 lastResultGroup） */
interface CaseFileRow {
    id: string;
    name?: string;
    description?: string;
    input: string;
    inputRichContent?: Array<{ type: string; text: string; name?: string; args?: Record<string, string> }>;
    criteria: string[];
    lastResultGroup?: BatchValidationStorageRow['resultGroups'][0];
}

const DEFAULT_META: BatchValidationMeta = {
    cases: [],
    selectedCaseIndex: 0,
    comprehensiveSelectedIndices: [],
    comprehensivePresets: [],
    sourceTabIndex: 0,
    evaluationMode: 'pass-fail'
};

export class BatchValidationRepository {
    private baseDir: string;
    private metaPath: string;

    constructor(serverName: string) {
        const dbDir = path.join(VSCODE_WORKSPACE || process.cwd(), '.openmcp', 'data');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        const safeName = escapeServerName(serverName);
        this.baseDir = path.join(dbDir, `batch-validation-${safeName}`);
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
        this.metaPath = path.join(this.baseDir, META_FILE);
    }

    private generateCaseId(offset = 0): string {
        return `${CASE_FILE_PREFIX}${Date.now() + offset}`;
    }

    private isCaseId(id: string): boolean {
        return typeof id === 'string' && id.startsWith(CASE_FILE_PREFIX) && /^\d+$/.test(id.slice(CASE_FILE_PREFIX.length));
    }

    private getCaseFilename(id: string): string {
        if (this.isCaseId(id)) {
            return `${id}${CASE_FILE_SUFFIX}`;
        }
        return `${this.generateCaseId()}${CASE_FILE_SUFFIX}`;
    }

    private loadMeta(): BatchValidationMeta {
        try {
            if (!fs.existsSync(this.metaPath)) return { ...DEFAULT_META };
            const raw = fs.readFileSync(this.metaPath, 'utf-8');
            const parsed = JSON.parse(raw) as BatchValidationMeta;
            return {
                cases: Array.isArray(parsed.cases) ? parsed.cases : DEFAULT_META.cases,
                selectedCaseIndex: typeof parsed.selectedCaseIndex === 'number' ? parsed.selectedCaseIndex : 0,
                comprehensiveSelectedIndices: Array.isArray(parsed.comprehensiveSelectedIndices) ? parsed.comprehensiveSelectedIndices : [],
                comprehensivePresets: Array.isArray(parsed.comprehensivePresets) ? parsed.comprehensivePresets : [],
                currentPresetId: typeof parsed.currentPresetId === 'string' ? parsed.currentPresetId : undefined,
                sourceTabIndex: typeof parsed.sourceTabIndex === 'number' ? parsed.sourceTabIndex : 0,
                evaluationMode: parsed.evaluationMode === 'score' ? 'score' : 'pass-fail'
            };
        } catch {
            return { ...DEFAULT_META };
        }
    }

    private saveMeta(meta: BatchValidationMeta): void {
        fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    }

    private loadCaseFile(filename: string): CaseFileRow | null {
        const fp = path.join(this.baseDir, filename);
        try {
            if (!fs.existsSync(fp)) return null;
            const raw = fs.readFileSync(fp, 'utf-8');
            return JSON.parse(raw) as CaseFileRow;
        } catch {
            return null;
        }
    }

    private saveCaseFile(filename: string, data: CaseFileRow): void {
        const fp = path.join(this.baseDir, filename);
        fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
    }

    private deleteCaseFile(filename: string): void {
        const fp = path.join(this.baseDir, filename);
        try {
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        } catch {
            // ignore
        }
    }

    async load(): Promise<BatchValidationStorageRow> {
        try {
            const meta = this.loadMeta();
            const testCases: BatchValidationStorageRow['testCases'] = [];
            const resultGroups: BatchValidationStorageRow['resultGroups'] = [];

            for (const entry of meta.cases) {
                const caseData = this.loadCaseFile(entry.filename);
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

            return {
                testCases,
                selectedCaseIndex: Math.min(meta.selectedCaseIndex, Math.max(0, testCases.length - 1)),
                comprehensiveSelectedIndices: meta.comprehensiveSelectedIndices,
                comprehensivePresets: meta.comprehensivePresets,
                currentPresetId: meta.currentPresetId,
                sourceTabIndex: meta.sourceTabIndex,
                evaluationMode: meta.evaluationMode,
                resultGroups
            };
        } catch {
            return this.loadFromLegacyConfig();
        }
    }

    private async loadFromLegacyConfig(): Promise<BatchValidationStorageRow> {
        const legacyPath = path.join(this.baseDir, 'config.json');
        try {
            if (!fs.existsSync(legacyPath)) {
                return {
                    testCases: [],
                    selectedCaseIndex: 0,
                    comprehensiveSelectedIndices: [],
                    comprehensivePresets: [],
                    sourceTabIndex: 0,
                    evaluationMode: 'pass-fail',
                    resultGroups: []
                };
            }
            const raw = fs.readFileSync(legacyPath, 'utf-8');
            let parsed: BatchValidationStorageRow;
            try {
                const obj = JSON.parse(raw);
                if (obj && typeof obj === 'object' && ('testCases' in obj || 'sourceTabIndex' in obj)) {
                    parsed = obj as BatchValidationStorageRow;
                } else {
                    throw new Error('Not legacy config');
                }
            } catch {
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
                        // skip
                    }
                }
                parsed = latest ?? { testCases: [], selectedCaseIndex: 0, comprehensiveSelectedIndices: [], comprehensivePresets: [], sourceTabIndex: 0, evaluationMode: 'pass-fail', resultGroups: [] };
            }
            await this.migrateFromLegacy(parsed);
            return this.normalizeStorage(parsed);
        } catch {
            return {
                testCases: [],
                selectedCaseIndex: 0,
                comprehensiveSelectedIndices: [],
                comprehensivePresets: [],
                sourceTabIndex: 0,
                evaluationMode: 'pass-fail',
                resultGroups: []
            };
        }
    }

    private async migrateFromLegacy(legacy: BatchValidationStorageRow): Promise<void> {
        const cases: CaseMetaEntry[] = [];
        const now = Date.now();
        for (let i = 0; i < (legacy.testCases?.length ?? 0); i++) {
            const tc = legacy.testCases![i];
            const id = this.isCaseId(tc.id) ? tc.id : this.generateCaseId(i);
            const filename = `${id}${CASE_FILE_SUFFIX}`;
            const resultGroup = legacy.resultGroups?.[i];
            this.saveCaseFile(filename, {
                id,
                name: tc.name,
                description: tc.description,
                input: tc.input ?? '',
                inputRichContent: tc.inputRichContent,
                criteria: Array.isArray(tc.criteria) ? tc.criteria : [],
                lastResultGroup: resultGroup
            });
            cases.push({
                id,
                filename,
                name: tc.name ?? `测试 #${i + 1}`,
                description: tc.description ?? '',
                createdAt: now,
                updatedAt: now
            });
        }
        this.saveMeta({
            cases,
            selectedCaseIndex: legacy.selectedCaseIndex ?? 0,
            comprehensiveSelectedIndices: legacy.comprehensiveSelectedIndices ?? [],
            comprehensivePresets: legacy.comprehensivePresets ?? [],
            currentPresetId: legacy.currentPresetId,
            sourceTabIndex: legacy.sourceTabIndex ?? 0,
            evaluationMode: legacy.evaluationMode === 'score' ? 'score' : 'pass-fail'
        });
        try {
            fs.unlinkSync(path.join(this.baseDir, 'config.json'));
        } catch {
            // ignore
        }
    }

    private normalizeStorage(parsed: BatchValidationStorageRow): BatchValidationStorageRow {
        return {
            testCases: Array.isArray(parsed.testCases) ? parsed.testCases : [],
            selectedCaseIndex: typeof parsed.selectedCaseIndex === 'number' ? parsed.selectedCaseIndex : 0,
            comprehensiveSelectedIndices: Array.isArray(parsed.comprehensiveSelectedIndices) ? parsed.comprehensiveSelectedIndices : [],
            comprehensivePresets: Array.isArray(parsed.comprehensivePresets) ? parsed.comprehensivePresets : [],
            currentPresetId: typeof parsed.currentPresetId === 'string' ? parsed.currentPresetId : undefined,
            sourceTabIndex: typeof parsed.sourceTabIndex === 'number' ? parsed.sourceTabIndex : 0,
            evaluationMode: parsed.evaluationMode === 'score' ? 'score' : 'pass-fail',
            resultGroups: Array.isArray(parsed.resultGroups) ? parsed.resultGroups : []
        };
    }

    async save(storage: BatchValidationStorageRow): Promise<void> {
        const normalized = this.normalizeStorage(storage);
        const meta = this.loadMeta();
        const caseMetaMap = new Map(meta.cases.map((c) => [c.id, c]));

        const newCases: CaseMetaEntry[] = [];
        const now = Date.now();

        for (let i = 0; i < normalized.testCases.length; i++) {
            const tc = normalized.testCases[i];
            const resultGroup = normalized.resultGroups[i];
            let id = tc.id;
            let filename: string;
            let entry = caseMetaMap.get(id);

            if (!entry) {
                id = this.generateCaseId();
                filename = `${id}${CASE_FILE_SUFFIX}`;
                entry = {
                    id,
                    filename,
                    name: tc.name ?? `测试 #${i + 1}`,
                    description: tc.description ?? '',
                    createdAt: now,
                    updatedAt: now
                };
            } else {
                filename = entry.filename;
                entry = {
                    ...entry,
                    name: tc.name ?? entry.name,
                    description: tc.description ?? entry.description,
                    updatedAt: now
                };
            }

            this.saveCaseFile(filename, {
                id,
                name: tc.name,
                description: tc.description,
                input: tc.input ?? '',
                inputRichContent: tc.inputRichContent,
                criteria: Array.isArray(tc.criteria) ? tc.criteria : [],
                lastResultGroup: resultGroup
            });
            newCases.push(entry);
        }

        const removedFilenames = meta.cases
            .filter((c) => !newCases.some((n) => n.id === c.id))
            .map((c) => c.filename);
        for (const f of removedFilenames) {
            this.deleteCaseFile(f);
        }

        this.saveMeta({
            ...meta,
            cases: newCases,
            selectedCaseIndex: normalized.selectedCaseIndex,
            comprehensiveSelectedIndices: normalized.comprehensiveSelectedIndices,
            comprehensivePresets: normalized.comprehensivePresets,
            currentPresetId: normalized.currentPresetId,
            sourceTabIndex: normalized.sourceTabIndex,
            evaluationMode: normalized.evaluationMode
        });
    }

    async close(): Promise<void> {
        // 无流需要关闭
    }
}

const repoMap = new Map<string, BatchValidationRepository>();

export function getBatchValidationRepository(serverName: string): BatchValidationRepository {
    const key = escapeServerName(serverName || 'default');
    if (!repoMap.has(key)) {
        repoMap.set(key, new BatchValidationRepository(serverName || 'default'));
    }
    return repoMap.get(key)!;
}
