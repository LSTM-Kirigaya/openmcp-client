import type { ChatMessage, RichTextItem } from '../chat/chat-box/chat';

/** 单个测试用例（可持久化） */
export interface BatchValidationTestCase {
    id: string;
    name?: string;
    description?: string;
    input: string;
    /** 提词卡片等富文本结构，用于刷新后恢复卡片展示 */
    inputRichContent?: RichTextItem[];
    criteria: string[];
    /** 评估模式：通过/失败 或 分数，每个用例单独设置 */
    evaluationMode?: 'pass-fail' | 'score';
    /** 该用例最近一次验证结果，切换用例时显示对应的结果 */
    lastResultGroup?: BatchValidationResultGroup;
}

/** 用户保存的综合测试预设（名称 + 用例索引列表） */
export interface BatchValidationComprehensivePreset {
    id: string;
    name: string;
    indices: number[];
}

/** 批量验证面板绑定到 tab.storage 的可持久化数据结构 */
export interface BatchValidationCriterionResult {
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
    /** 本条评估消耗的 token（仅评估 LLM） */
    evalInputTokens?: number;
    evalOutputTokens?: number;
}

export interface BatchValidationAgentLoopStats {
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    toolCallCount: number;
}

export interface BatchValidationResultGroup {
    testCaseIndex: number;
    testInput: string;
    inputRichContent?: RichTextItem[];
    agentMessages?: ChatMessage[];
    agentLoopStats?: BatchValidationAgentLoopStats;
    criterionResults: BatchValidationCriterionResult[];
}

export interface BatchValidationStorage {
    /** 测试用例列表（左侧一行一个，可任意添加） */
    testCases: BatchValidationTestCase[];
    /** 当前选中的测试用例索引 */
    selectedCaseIndex: number;
    /** 综合测试勾选的用例索引（多选合并执行） */
    comprehensiveSelectedIndices: number[];
    /** 用户保存的综合测试预设列表 */
    comprehensivePresets: BatchValidationComprehensivePreset[];
    /** 当前选中的综合测试预设 id（用于按钮展示） */
    currentPresetId?: string;
    /** 运行批量验证时使用的交互测试标签页索引（取该 tab 的配置） */
    sourceTabIndex: number;
    /** 批量验证日志结果（用于日志面板持久化恢复） */
    resultGroups: BatchValidationResultGroup[];
    /** @deprecated 仅用于从旧数据迁移，迁移后不再使用 */
    testCasesByTabIndex?: Record<number, BatchValidationTestCase>;
    /** @deprecated 请使用 selectedCaseIndex */
    selectedTabIndex?: number;
}

const DEFAULT_STORAGE: BatchValidationStorage = {
    testCases: [],
    selectedCaseIndex: 0,
    comprehensiveSelectedIndices: [],
    comprehensivePresets: [],
    sourceTabIndex: 0,
    resultGroups: []
};

/** 确保 storage 具备 BatchValidationStorage 形状（就地补全缺失字段，并从旧结构迁移） */
export function ensureBatchValidationStorage(storage: Record<string, any>): storage is BatchValidationStorage {
    const oldByTab = storage.testCasesByTabIndex;
    const hasOld = typeof oldByTab === 'object' && oldByTab !== null && Object.keys(oldByTab).length > 0;
    if (!Array.isArray(storage.testCases)) {
        if (hasOld) {
            const indices = Object.keys(oldByTab)
                .map(Number)
                .filter((n) => Number.isInteger(n))
                .sort((a, b) => a - b);
            storage.testCases = indices.map((i) => ({ ...oldByTab[i] }));
            storage.selectedCaseIndex = typeof storage.selectedTabIndex === 'number' ? Math.min(storage.selectedTabIndex, storage.testCases.length - 1) : 0;
        } else {
            storage.testCases = [];
        }
    }
    if (typeof storage.selectedCaseIndex !== 'number') {
        storage.selectedCaseIndex = typeof storage.selectedTabIndex === 'number' ? storage.selectedTabIndex : DEFAULT_STORAGE.selectedCaseIndex;
    }
    if (!Array.isArray(storage.comprehensiveSelectedIndices)) {
        storage.comprehensiveSelectedIndices = DEFAULT_STORAGE.comprehensiveSelectedIndices;
    }
    if (!Array.isArray(storage.comprehensivePresets)) {
        storage.comprehensivePresets = DEFAULT_STORAGE.comprehensivePresets;
    }
    if (typeof storage.sourceTabIndex !== 'number') {
        storage.sourceTabIndex = DEFAULT_STORAGE.sourceTabIndex;
    }
    if (!Array.isArray(storage.resultGroups)) {
        storage.resultGroups = [];
    }
    if (!Array.isArray(storage.messages)) {
        storage.messages = [];
    }
    storage.selectedCaseIndex = Math.max(0, Math.min(storage.selectedCaseIndex, Math.max(0, storage.testCases.length - 1)));
    return true;
}
