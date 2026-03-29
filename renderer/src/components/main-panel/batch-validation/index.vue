<template>
    <div class="batch-validation-container">
        <el-splitter class="batch-validation-splitter">
            <el-splitter-panel :min="180" :max="480" :size="300" class="batch-splitter-panel-left">
                <div class="batch-list-panel">
            <div class="list-header">
                <div class="list-add-btn-wrap">
                    <el-button-group class="executor-actions-group list-header-btn-group">
                        <el-button class="list-add-btn" @click="addTestCaseFromList">
                            <span class="list-add-btn-text">{{ t('batch-validation-add-sample') }}</span>
                        </el-button>
                        <el-button type="primary" class="list-comprehensive-btn"
                            :loading="isRunning" :disabled="!canRunComprehensive"
                            @click="runComprehensiveValidation">
                            <span class="list-comprehensive-btn-text">{{ comprehensiveButtonLabel }}</span>
                        </el-button>
                        <el-button type="danger" class="list-delete-btn"
                            :disabled="comprehensiveSelectedSet.size === 0 || isRunning"
                            @click="deleteSelectedTestCases">
                            <span class="iconfont icon-delete"></span>
                        </el-button>
                    </el-button-group>
                </div>
            </div>
            <div class="list-container">
                <el-scrollbar>
                    <div class="list-inner">
                        <div v-for="item in listItems" :key="item.tc.id" class="list-item"
                            :class="{ active: tabStorage.selectedCaseIndex === item.caseIndex }"
                            @click="selectTestCase(item.caseIndex)">
                            <el-checkbox :model-value="comprehensiveSelectedSet.has(item.caseIndex)" class="list-item-checkbox"
                                :title="t('batch-validation-comprehensive-hint')"
                                @click.stop
                                @update:model-value="toggleComprehensiveSelection(item.caseIndex)" />
                            <div class="list-item-content">
                                <div class="item-title">
                                    {{ getListItemTitle(item.caseIndex) }}
                                </div>
                                <div v-if="getListItemPreview(item.caseIndex)" class="item-preview">
                                    {{ getListItemPreview(item.caseIndex) }}
                                </div>
                                <div v-else class="item-empty">-</div>
                            </div>
                            <el-button type="default" circle class="list-item-setting-btn"
                                :title="t('batch-validation-settings-drawer-title')"
                                @click.stop="openSettingsForTab(item.caseIndex)">
                                <span class="iconfont icon-setting"></span>
                            </el-button>
                            <div class="list-item-result-bar" :class="{
                                'has-result': !!getListItemPassFail(item),
                                'is-running': runningCaseIndices.has(item.caseIndex)
                            }"
                                :style="getListItemPassFail(item) ? { '--pass-pct': (getListItemPassFail(item)!.pass * 100) + '%' } : {}" />
                        </div>
                        <div v-if="listItems.length === 0" class="list-empty">
                            {{ t('batch-validation-no-cases-hint') }}
                        </div>
                    </div>
                </el-scrollbar>
            </div>
                </div>
            </el-splitter-panel>
            <el-splitter-panel class="batch-splitter-panel-right">
                <el-splitter layout="vertical" class="batch-right-vertical-splitter">
                    <el-splitter-panel :min="180" :max="600" size="80%" class="batch-executor-panel">
                        <div class="batch-detail-panel">
                            <el-scrollbar>
                <div v-if="listItems.length === 0" class="no-selection">
                </div>
                <div v-else-if="formModel" class="detail-content">
                    <div class="detail-section detail-actions-top">
                        <div class="detail-actions-row">
                            <el-input v-model="formModel.name" :placeholder="defaultTestCaseName"
                                class="detail-name-input" />
                            <div class="detail-actions-right">
                                <el-button-group class="detail-run-btn-group">
                                    <el-button type="default" class="detail-setting-btn"
                                        :title="t('batch-validation-settings-drawer-title')"
                                        @click="settingsDrawerVisible = true">
                                        {{ t('batch-validation-configure-sample') }}
                                    </el-button>
                                    <el-button v-if="!isSelectedCaseRunning" type="primary" :disabled="!canRun"
                                        class="detail-run-btn" @click="runValidationCurrentCase">
                                        <span>{{ t('batch-validation-run') }}</span>
                                        <span class="ctrl">CTRL</span>
                                        <span class="iconfont icon-enter"></span>
                                    </el-button>
                                    <el-button v-else type="warning" class="detail-run-btn" @click="abortValidation">
                                        <span class="iconfont icon-stop"></span>
                                        {{ t('batch-validation-pause') }}
                                    </el-button>
                                </el-button-group>
                            </div>
                        </div>
                        <div v-if="!canRun && runDisabledReason" class="detail-hint">{{ runDisabledReason }}</div>
                    </div>
                    <div class="detail-section">
                        <label class="detail-section-label">{{ t('batch-validation-test-input') }}</label>
                        <BatchValidationInput :ref="el => setTcInputRef(formModel?.id ?? '', el)" :tab-id="props.tabId" v-model="formModel.input"
                            :source-storage="sourceStorage"
                            :placeholder="t('batch-validation-test-input-placeholder')"
                            @mod-enter="runValidationCurrentCase" />
                    </div>
                    <div class="detail-section">
                        <label class="detail-section-label">{{ t('batch-validation-criteria-list') }}</label>
                        <div v-for="(c, cIdx) in formModel.criteria" :key="`${formModel.id}-criteria-${cIdx}`"
                            class="criterion-item">
                            <el-input v-model="formModel.criteria[cIdx]" type="textarea" :rows="2"
                                :placeholder="t('batch-validation-criterion-placeholder')" />
                            <el-button type="danger" text :disabled="formModel.criteria.length <= 1"
                                @click="removeCriterion(cIdx)">
                                <span class="iconfont icon-delete"></span>
                            </el-button>
                        </div>
                        <el-button @click="addCriterion" class="add-criterion-btn">
                            <span class="iconfont icon-add"></span>
                            {{ t('batch-validation-add-criterion') }}
                        </el-button>
                    </div>
                </div>
                <div v-else class="no-selection">
                    <el-empty />
                </div>
            </el-scrollbar>
                        </div>
                    </el-splitter-panel>
                    <el-splitter-panel size="20%" :min="120" class="batch-results-panel">
                        <div class="batch-results-wrap">
                            <div class="batch-results-header">
                                <span class="batch-results-header-title">
                                    {{ t('batch-validation-results') }}
                                    <span v-if="isSelectedCaseRunning" class="batch-results-header-loading">
                                        <svg class="batch-results-loading-spinner" viewBox="0 0 24 24" width="16" height="16">
                                            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"
                                                stroke-dasharray="47 16" stroke-linecap="round" />
                                        </svg>
                                        <span class="batch-results-loading-text">{{ runStatusText }}</span>
                                    </span>
                                </span>
                                <span v-if="(currentTestCase?.evaluationMode ?? 'pass-fail') === 'pass-fail'" class="batch-results-header-stats">
                                    <span class="batch-results-header-stat pass">pass: {{ passFailSummary.pass }}</span>
                                    <span class="batch-results-header-stat fail">fail: {{ passFailSummary.fail }}</span>
                                    <el-tooltip :content="t('batch-validation-agent-duration')" placement="top">
                                        <span class="batch-results-header-stat icon-stat">
                                            <span class="batch-results-header-stat-icon iconfont icon-waiting"></span>
                                            <span>{{ formatDuration(passFailSummary.durationMs) }}</span>
                                        </span>
                                    </el-tooltip>
                                    <el-tooltip :content="t('batch-validation-trace-input-token')" placement="top">
                                        <span class="batch-results-header-stat icon-stat">
                                            <el-icon class="batch-results-header-stat-icon"><ArrowDown /></el-icon>
                                            <span>{{ passFailSummary.inputTokens }}</span>
                                        </span>
                                    </el-tooltip>
                                    <el-tooltip :content="t('batch-validation-trace-output-token')" placement="top">
                                        <span class="batch-results-header-stat icon-stat">
                                            <el-icon class="batch-results-header-stat-icon is-up"><ArrowDown /></el-icon>
                                            <span>{{ passFailSummary.outputTokens }}</span>
                                        </span>
                                    </el-tooltip>
                                </span>
                            </div>
                            <el-scrollbar class="batch-results-scroll">
                                <div class="batch-results-body">
                                    <div class="batch-results-content">
                                        <div v-if="currentResultGroups.length === 0" class="batch-results-empty">
                                            <span class="batch-results-empty-text">{{ t('batch-validation-results-empty-hint') }}</span>
                                        </div>
                                        <div v-else class="batch-log-history">
                                            <div v-for="(group, gIdx) in currentResultGroups" :key="gIdx">
                                                    <div class="batch-log-evaluation">
                                                        <div v-for="(r, rIdx) in group.criterionResults" :key="rIdx" class="batch-log-eval-item" :class="{ error: r.error }">
                                                            <div class="batch-log-eval-header">
                                                                <span class="batch-log-eval-index">{{ r.testCaseCriteria || `#${rIdx + 1}` }}</span>
                                                                <span v-if="(currentTestCase?.evaluationMode ?? 'pass-fail') === 'pass-fail'" class="result-badge"
                                                                    :class="r.pass === true ? 'pass' : r.pass === false ? 'fail' : 'unknown'">
                                                                    {{ r.pass === true ? t('batch-validation-pass') : r.pass === false ? t('batch-validation-fail') : '?' }}
                                                                </span>
                                                                <span v-else class="result-score">
                                                                    {{ r.score !== undefined ? (r.score / 10).toFixed(1) + '/1' : '-' }}
                                                                </span>
                                                            </div>
                                                            <div v-if="r.reason" class="batch-log-eval-reason markdown-body" v-html="markdownToHtml(r.reason)"></div>
                                                            <div v-if="r.error" class="result-error">{{ r.error }}</div>
                                                        </div>
                                                        <div v-if="getGroupEvalTokens(group).total > 0" class="batch-log-eval-tokens">
                                                            <span class="batch-log-eval-tokens-label">{{ t('batch-validation-eval-tokens') }}</span>
                                                            <el-tooltip :content="t('input-token')" placement="top">
                                                                <span class="batch-log-eval-tokens-stat">
                                                                    <el-icon class="batch-log-eval-tokens-icon"><ArrowDown /></el-icon>
                                                                    {{ getGroupEvalTokens(group).input }}
                                                                </span>
                                                            </el-tooltip>
                                                            <el-tooltip :content="t('output-token')" placement="top">
                                                                <span class="batch-log-eval-tokens-stat">
                                                                    <el-icon class="batch-log-eval-tokens-icon is-up"><ArrowDown /></el-icon>
                                                                    {{ getGroupEvalTokens(group).output }}
                                                                </span>
                                                            </el-tooltip>
                                                        </div>
                                                    </div>
                                                    <hr>
                                                    <h2>Trace</h2>
                                                    <BatchValidationAgentTrace
                                                        v-if="group.agentMessages?.length || group.testInput || group.inputRichContent?.length"
                                                        :messages="group.agentMessages ?? []"
                                                        :tab-id="props.tabId"
                                                        :input-rich-content="group.inputRichContent"
                                                        :fallback-input="group.agentMessages?.length ? undefined : group.testInput"
                                                        :collapse-tools-by-default="true"
                                                    />
                                                </div>
                                            </div>
                                    </div>
                                </div>
                            </el-scrollbar>
                        </div>
                    </el-splitter-panel>
                </el-splitter>
            </el-splitter-panel>
        </el-splitter>
            <!-- 从右往左拉出的配置抽屉：当前测试样例的 pass/score、描述等 -->
            <Teleport to="body">
                <Transition name="settings-drawer">
                    <div v-if="settingsDrawerVisible && formModel" class="settings-drawer-mask"
                        @click.self="settingsDrawerVisible = false">
                        <div class="settings-drawer-panel">
                            <div class="settings-drawer-header">
                                <span class="settings-drawer-title">{{ t('batch-validation-settings-drawer-title')
                                    }}</span>
                                <el-button type="primary" text circle @click="settingsDrawerVisible = false">
                                    <span class="iconfont icon-close"></span>
                                </el-button>
                            </div>
                            <div class="settings-drawer-body">
                                <div class="settings-drawer-section">
                                    <label class="settings-drawer-section-label">{{ t('batch-validation-evaluation-mode') }}</label>
                                    <el-select v-model="formModel.evaluationMode" class="settings-drawer-mode-select"
                                        :placeholder="t('batch-validation-evaluation-mode')">
                                        <el-option :value="'pass-fail'" :label="t('batch-validation-mode-pass-fail')" />
                                        <el-option :value="'score'" :label="t('batch-validation-mode-score')" />
                                    </el-select>
                                </div>
                                <div class="settings-drawer-section">
                                    <label class="settings-drawer-section-label">{{ t('batch-validation-test-case-desc') }}</label>
                                    <el-input v-model="formModel.description" type="textarea" :rows="4"
                                        :placeholder="t('batch-validation-test-case-desc-placeholder')" />
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessageBridge } from '@/api/message-bridge';
import { tabs } from '../panel';
import { llms, llmManager } from '@/views/setting/llm';
import { ElMessage, ElMessageBox, ElIcon } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ChatStorage, ChatSetting, EnableToolItem } from '../chat/chat-box/chat';
import { TaskLoop } from '../chat/core/task-loop';
import { loadSkillContent } from '@/api/skill';
import { mcpClientAdapter } from '@/views/connect/core';
import BatchValidationInput from './batch-validation-input.vue';
import BatchValidationAgentTrace from './batch-validation-agent-trace.vue';
import { markdownToHtml } from '../chat/markdown/markdown';
import type {
    BatchValidationStorage,
    BatchValidationTestCase,
    BatchValidationCriterionResult,
    BatchValidationAgentLoopStats,
    BatchValidationResultGroup
} from './storage';
import { ensureBatchValidationStorage } from './storage';
import { getModEnterShortcutText } from '@/util/keyboard';

const { t } = useI18n();
const modEnterShortcutText = getModEnterShortcutText();
const props = defineProps({
    tabId: { type: Number, required: true }
});

type TestCase = BatchValidationTestCase;

const tcInputRefs = new Map<string, InstanceType<typeof BatchValidationInput>>();

function setTcInputRef(tcId: string, el: any) {
    if (el) tcInputRefs.set(tcId, el);
    else tcInputRefs.delete(tcId);
}

type ValidationResult = BatchValidationCriterionResult;
type AgentLoopStats = BatchValidationAgentLoopStats;
type ResultGroup = BatchValidationResultGroup;

/** 当前 tab 的持久化数据（绑定到 tab.storage，与 chat/index.vue 一致） */
const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as BatchValidationStorage;


ensureBatchValidationStorage(tab.storage);

// 供 Message.User / Message.Assistant / Message.Toolcall 注入使用（批量验证结果展示复用交互测试组件）
provide('chatContext', { handleSend: () => {} });
provide('chatMode', ref('single-chat'));
provide('parallelChats', ref([]));
provide('updateChatRenderMessages', () => {});

const isRunning = ref(false);
const runStatusText = ref('');
/** 当前正在执行的测试用例索引集合（综合测试时多个，单用例时一个），用于列表项和详情区 UI */
const runningCaseIndices = ref<Set<number>>(new Set());
/** 当前执行中的 TaskLoop 映射（caseIndex -> loop），用于暂停时 abort 所有 */
const taskLoopRefsByCase = new Map<number, InstanceType<typeof TaskLoop>>();
/** 用户请求中止当前执行 */
const abortRequested = ref(false);
const results = ref<ValidationResult[]>([]);
const resultGroupsWithStats = ref<ResultGroup[]>(tabStorage.resultGroups ?? []);
/** 从右往左拉出的配置抽屉（pass/score、描述等） */
const settingsDrawerVisible = ref(false);

const chatTabs = computed(() => {
    return tabs.content
        .map((tab, idx) => ({ tab, originalIndex: idx }))
        .filter(({ tab }) => tab.componentIndex === 3);
});

/** 批量验证与交互测试隔离：不共享数据，始终为 null，由 BatchValidationInput 使用自身默认配置 */
const sourceStorage = computed((): ChatStorage | null => null);

function getTabLabel(tab: { name: string; icon: string }, idx: number) {
    const name = typeof tab.name === 'string' ? tab.name : (tab.name as any)?.value ?? '';
    return `${name || t('batch-validation-default-case-name')} #${idx + 1}`;
}

/** 当前测试用例的默认名称（与左侧列表一致：测试 #n） */
const defaultTestCaseName = computed(() => {
    const idx = tabStorage.selectedCaseIndex;
    return t('batch-validation-default-case-name') + ' #' + (idx + 1);
});

/** 列表项标题：优先显示测试用例名称，否则显示默认名（含草稿） */
function getListItemTitle(caseIndex: number) {
    const arr = tabStorage.testCases || [];
    const tc = arr[caseIndex] ?? (caseIndex === tabStorage.selectedCaseIndex ? draftTestCase.value : null);
    if (tc?.name?.trim()) return tc.name;
    return t('batch-validation-default-case-name') + ' #' + (caseIndex + 1);
}

/** 列表项预览：描述或输入摘要（含草稿） */
function getListItemPreview(caseIndex: number) {
    const arr = tabStorage.testCases || [];
    const tc = arr[caseIndex] ?? (caseIndex === tabStorage.selectedCaseIndex ? draftTestCase.value : null);
    if (!tc) return '';
    if (tc.description?.trim()) return tc.description;
    if (tc.input?.trim()) return tc.input.substring(0, 40) + (tc.input.length > 40 ? '...' : '');
    return '';
}

/** 列表项 pass/fail 比例（用于右侧可视化条） */
function getListItemPassFail(item: { caseIndex: number; tc: TestCase }) {
    const g = item.tc.lastResultGroup;
    if (!g?.criterionResults?.length) return null;
    let pass = 0;
    let fail = 0;
    for (const r of g.criterionResults) {
        if (r.pass === true) pass++;
        else if (r.pass === false || r.error) fail++;
    }
    const total = pass + fail;
    if (total === 0) return null;
    return { pass: pass / total, fail: fail / total };
}

/** 当前选中的用例是否正在执行（用于详情区：仅此时显示暂停按钮和 running 状态） */
const isSelectedCaseRunning = computed(() =>
    runningCaseIndices.value.has(tabStorage.selectedCaseIndex ?? -1)
);

/** 当前选中的测试用例（已持久化） */
const currentTestCase = computed(() => {
    const arr = tabStorage.testCases;
    const idx = tabStorage.selectedCaseIndex;
    return arr && arr[idx] ? arr[idx] : null;
});

/** 当前表单数据：持久化的测试案例 或 未保存的草稿（选中无表单的标签页时） */
const formModel = computed(() => {
    return currentTestCase.value ?? draftTestCase.value;
});

/** 未保存的草稿（当选中标签页尚无测试案例时使用） */
const draftTestCase = ref<TestCase | null>(null);

function createEmptyTestCase(): TestCase {
    return { id: uuidv4(), name: '', description: '', input: '', criteria: [''], evaluationMode: 'pass-fail' };
}

/** 将草稿持久化到当前选中的测试用例位 */
function commitDraftToCase() {
    const draft = draftTestCase.value;
    if (!draft) return;
    const idx = tabStorage.selectedCaseIndex;
    const arr = tabStorage.testCases;
    if (arr && idx >= 0 && idx < arr.length) {
        arr[idx] = { ...draft };
    } else {
        tabStorage.testCases = [...(arr || []), { ...draft }];
        tabStorage.selectedCaseIndex = tabStorage.testCases.length - 1;
    }
    draftTestCase.value = null;
}

/** 当前选中测试用例的验证结果，切换用例时显示对应的结果 */
const currentResultGroups = computed((): ResultGroup[] => {
    const tc = currentTestCase.value;
    const g = tc?.lastResultGroup;
    return g ? [g] : [];
});

const passFailSummary = computed(() => {
    let pass = 0;
    let fail = 0;
    let durationMs = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    for (const group of currentResultGroups.value) {
        for (const item of group.criterionResults || []) {
            if (item.pass === true) pass++;
            else if (item.pass === false || item.error) fail++;
        }
        durationMs += group.agentLoopStats?.durationMs || 0;
        inputTokens += group.agentLoopStats?.inputTokens || 0;
        outputTokens += group.agentLoopStats?.outputTokens || 0;
    }
    return { pass, fail, durationMs, inputTokens, outputTokens };
});

/** 分数模式下的汇总文本（当前用例的 lastResultGroup） */
const scoreSummaryText = computed(() => {
    let total = 0;
    let count = 0;
    for (const group of currentResultGroups.value) {
        for (const r of group.criterionResults || []) {
            if (r.score !== undefined) {
                total += r.score;
                count++;
            }
        }
    }
    if (count === 0) return '-';
    return ((total / count) / 10).toFixed(1) + '/1';
});

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
}

/** 汇总单个 session 的验证阶段 token 消耗（仅评估 LLM，不含 trace） */
function getGroupEvalTokens(group: BatchValidationResultGroup): { input: number; output: number; total: number } {
    let input = 0;
    let output = 0;
    for (const r of group.criterionResults || []) {
        input += r.evalInputTokens ?? 0;
        output += r.evalOutputTokens ?? 0;
    }
    return { input, output, total: input + output };
}

/** 只统计 assistant 消息上的 usage，避免同一轮 usage 在 assistant + 多条 tool 上重复累加 */
function extractAgentLoopStats(messages: ChatMessage[], startTime: number): AgentLoopStats {
    let inputTokens = 0;
    let outputTokens = 0;
    let toolCallCount = 0;
    for (const m of messages) {
        if (m.role === 'tool') {
            toolCallCount++;
            continue;
        }
        if (m.role !== 'assistant') continue;
        const usage = (m as any).extraInfo?.usage;
        if (usage) {
            inputTokens += usage.prompt_tokens || 0;
            outputTokens += usage.completion_tokens || 0;
        }
    }
    return {
        durationMs: Date.now() - startTime,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        toolCallCount
    };
}

const validTestCases = computed(() => {
    const cases: Array<{ caseIndex: number; tc: TestCase }> = [];
    const arr = tabStorage.testCases || [];
    arr.forEach((tc, caseIndex) => {
        if (tc.input.trim() && tc.criteria.some((c) => c.trim())) {
            cases.push({ caseIndex, tc });
        }
    });
    return cases;
});

const canRun = computed(() => {
    return (
        validTestCases.value.length > 0 &&
        llms.length > 0 &&
        mcpClientAdapter.connected
    );
});

const runDisabledReason = computed(() => {
    if (!mcpClientAdapter.connected) return t('batch-validation-not-connected');
    if (validTestCases.value.length === 0) return '';
    if (llms.length === 0) return t('batch-validation-no-llm');
    return '';
});

/** 左侧列表数据：测试用例列表（一行一个） */
const listItems = computed(() => {
    const arr = tabStorage.testCases || [];
    return arr.map((tc, caseIndex) => ({ caseIndex, tc }));
});

/** 综合测试勾选集合（用于 checkbox 展示与快捷判断） */
const comprehensiveSelectedSet = computed(() => {
    const arr = tabStorage.comprehensiveSelectedIndices ?? [];
    return new Set(arr);
});

function toggleComprehensiveSelection(caseIndex: number) {
    const arr = tabStorage.comprehensiveSelectedIndices ?? [];
    const set = new Set(arr);
    if (set.has(caseIndex)) {
        set.delete(caseIndex);
    } else {
        set.add(caseIndex);
    }
    tabStorage.comprehensiveSelectedIndices = Array.from(set).sort((a, b) => a - b);
}

/** 综合测试按钮文案：“执行综合测试 (N 项)” 或 “执行综合测试” */
const comprehensiveButtonLabel = computed(() => {
    const n = comprehensiveSelectedSet.value.size;
    return t('batch-validation-run-comprehensive');
});

/** 综合测试用例：仅使用勾选的有效用例，必须至少勾选一个 */
const comprehensiveTestCases = computed(() => {
    const indices = new Set(tabStorage.comprehensiveSelectedIndices ?? []);
    return validTestCases.value.filter(({ caseIndex }) => indices.has(caseIndex));
});
const canRunComprehensive = computed(() => {
    return validTestCases.value.length > 0 && llms.length > 0 && mcpClientAdapter.connected;
});

function abortValidation() {
    abortRequested.value = true;
    for (const loop of taskLoopRefsByCase.values()) {
        loop?.abort();
    }
}

/** 仅执行当前选中的测试样例（详情区「执行验证」按钮） */
function runValidationCurrentCase() {
    runValidation(false);
}

/** 综合测试入口：必须至少勾选一个，执行后清空勾选 */
async function runComprehensiveValidation() {
    if (comprehensiveSelectedSet.value.size === 0) {
        ElMessage.warning(t('batch-validation-select-at-least-one'));
        return;
    }
    await runValidation(true);
    tabStorage.comprehensiveSelectedIndices = [];
}

/** 删除所有框选的测试样例 */
async function deleteSelectedTestCases() {
    const selected = comprehensiveSelectedSet.value;
    if (selected.size === 0) return;
    try {
        await ElMessageBox.confirm(
            t('batch-validation-delete-selected-confirm', { count: selected.size }),
            t('batch-validation-delete-selected-title'),
            {
                confirmButtonText: t('confirm'),
                cancelButtonText: t('cancel'),
                type: 'warning'
            }
        );
    } catch {
        return;
    }
    if (draftTestCase.value) {
        commitDraftToCase();
    }
    const arr = tabStorage.testCases || [];
    const toDelete = new Set(selected);
    const remaining = arr.filter((_, i) => !toDelete.has(i));
    const indexMap = new Map<number, number>();
    let newIdx = 0;
    for (let i = 0; i < arr.length; i++) {
        if (!toDelete.has(i)) {
            indexMap.set(i, newIdx);
            newIdx++;
        }
    }
    tabStorage.testCases = remaining;
    tabStorage.comprehensiveSelectedIndices = [];
    const oldSelected = tabStorage.selectedCaseIndex;
    if (toDelete.has(oldSelected)) {
        tabStorage.selectedCaseIndex = 0;
        if (remaining.length === 0) draftTestCase.value = null;
    } else {
        tabStorage.selectedCaseIndex = indexMap.get(oldSelected) ?? 0;
    }
    const resultGroups = tabStorage.resultGroups ?? [];
    tabStorage.resultGroups = resultGroups
        .filter((g) => indexMap.has(g.testCaseIndex))
        .map((g) => ({ ...g, testCaseIndex: indexMap.get(g.testCaseIndex)! }));
    resultGroupsWithStats.value = tabStorage.resultGroups;
}

function selectTestCase(caseIndex: number) {
    if (caseIndex === tabStorage.selectedCaseIndex) return;
    if (draftTestCase.value) {
        commitDraftToCase();
    }
    // 切换前提取当前编辑器富文本并保存到当前用例
    const curTc = formModel.value;
    if (curTc) {
        const inputRef = tcInputRefs.get(curTc.id);
        const richContent = inputRef?.editorRef?.extractRichContent?.() ?? [];
        if (richContent.length > 0) curTc.inputRichContent = richContent;
    }
    tabStorage.selectedCaseIndex = caseIndex;
}

/** 切换到指定测试用例并打开配置抽屉（列表项右侧齿轮点击） */
function openSettingsForTab(caseIndex: number) {
    selectTestCase(caseIndex);
    settingsDrawerVisible.value = true;
}

/** 从列表头添加：保存当前表单（含草稿），在列表末尾新增一条测试用例并选中 */
function addTestCaseFromList() {
    if (draftTestCase.value) {
        commitDraftToCase();
    }
    const curTc = formModel.value;
    if (curTc) {
        const inputRef = tcInputRefs.get(curTc.id);
        const richContent = inputRef?.editorRef?.extractRichContent?.() ?? [];
        if (richContent.length > 0) curTc.inputRichContent = richContent;
    }
    const arr = tabStorage.testCases || [];
    const next = createEmptyTestCase();
    tabStorage.testCases = [...arr, next];
    tabStorage.selectedCaseIndex = tabStorage.testCases.length - 1;
}

function addCriterion() {
    const tc = formModel.value;
    if (tc) tc.criteria.push('');
}

function removeCriterion(cIndex: number) {
    const tc = formModel.value;
    if (tc && tc.criteria.length > 1) tc.criteria.splice(cIndex, 1);
}

function messagesToTrace(messages: ChatMessage[]): Array<{ role: string; content: string }> {
    return messages.map((m) => {
        if (m.role === 'tool') {
            const content = Array.isArray(m.content)
                ? JSON.stringify(m.content)
                : String(m.content ?? '');
            return { role: 'tool', content };
        }
        const content = typeof m.content === 'string' ? m.content : String(m.content ?? '');
        return { role: m.role, content };
    });
}

async function runValidation(comprehensive = false) {
    if (draftTestCase.value) {
        commitDraftToCase();
    }
    const curTc = formModel.value;
    if (curTc) {
        const inputRef = tcInputRefs.get(curTc.id);
        const richContent = inputRef?.editorRef?.extractRichContent?.() ?? [];
        if (richContent.length > 0) curTc.inputRichContent = richContent;
    }
    if (!canRun.value) return;

    const llm = llms[llmManager.currentModelIndex] ?? llms[0];
    if (!llm) {
        ElMessage.error(t('batch-validation-no-llm'));
        return;
    }

    isRunning.value = true;
    abortRequested.value = false;
    results.value = [];
    resultGroupsWithStats.value = [];
    tabStorage.resultGroups = [];
    const bridge = useMessageBridge();

    const llmConfig = {
        baseURL: llm.baseUrl || 'https://api.openai.com/v1',
        apiKey: llm.userToken || '',
        model: llm.userModel || llm.models?.[0] || '',
        temperature: 0
    };

    /** 单用例：仅当前选中；综合：勾选或预设 */
    const selectedIdx = tabStorage.selectedCaseIndex ?? 0;
    const casesToRun = comprehensive
        ? comprehensiveTestCases.value
        : (() => {
            const arr = tabStorage.testCases || [];
            const tc = arr[selectedIdx];
            if (!tc?.input?.trim() || !tc.criteria?.some((c: string) => c.trim())) return [];
            return [{ caseIndex: selectedIdx, tc }];
        })();
    if (casesToRun.length === 0) {
        ElMessage.warning(comprehensive ? t('batch-validation-select-at-least-one') : t('batch-validation-invalid-cases'));
        isRunning.value = false;
        runningCaseIndices.value = new Set();
        return;
    }
    runningCaseIndices.value = new Set(casesToRun.map((c) => c.caseIndex));
    taskLoopRefsByCase.clear();

    try {
        const allResults: ValidationResult[] = [];
        const groupsWithStats: ResultGroup[] = [];

        /** 与交互测试隔离：使用 MCP 已连接客户端的工具列表（与交互测试一致，默认全部启用） */
        const tempLoop = new TaskLoop({ maxEpochs: 50, verbose: 0 });
        const mcpTools = await tempLoop.listTools();
        const defaultEnableTools: EnableToolItem[] = mcpTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            enabled: true
        }));

        /** 与交互测试隔离：task loop 始终使用独立的默认配置，enableTools 来自 MCP */
        const createDefaultBaseStorage = (): ChatStorage => ({
            id: uuidv4(),
            messages: [],
            settings: {
                modelIndex: llmManager.currentModelIndex,
                enableTools: defaultEnableTools,
                enableWebSearch: false,
                temperature: 0.6,
                contextLength: 100,
                systemPrompt: '',
                enableXmlWrapper: false,
                parallelToolCalls: true
            }
        });

        async function runSingleCase(
            { caseIndex, tc }: { caseIndex: number; tc: TestCase }
        ): Promise<ResultGroup> {
            const input = tc.input.trim();
            const criteria = tc.criteria.filter((c) => c.trim());
            const inputRef = tcInputRefs.get(tc.id);
            const inputVirtualStorageSettings = (inputRef?.virtualStorage as any)?.value?.settings ?? {};
            const baseStorage = createDefaultBaseStorage();
            const storage: ChatStorage = {
                ...baseStorage,
                id: uuidv4(),
                messages: []
            };
            storage.settings = { ...baseStorage.settings, ...inputVirtualStorageSettings };
            const slashParsed = inputRef?.parseSlashCommand?.(input);
            if (slashParsed?.skillName) {
                (storage as any)._skillOverrideForNextMessage = slashParsed.skillName;
            }
            const skillContent = await loadSkillContent(slashParsed?.skillName);
            const hasSkillContext = !!skillContent && (!!slashParsed || storage.messages.length === 0);
            const loop = new TaskLoop({ maxEpochs: storage.settings?.contextLength || 50, verbose: 0 });
            const dummyContent = ref('');
            const dummyToolCalls = ref<any[]>([]);
            loop.bindStreaming(dummyContent, dummyToolCalls);
            loop.registerOnError((err) => console.error('[BatchValidation] Agent error:', err));
            const actualInput = slashParsed?.actualMessage !== undefined ? slashParsed.actualMessage || input : input;
            const loopStartTime = Date.now();
            taskLoopRefsByCase.set(caseIndex, loop);
            await loop.start(storage, actualInput, { mode: 'batch-validation', hasSkillContext });
            if (abortRequested.value) throw new Error('abort');
            const agentStats = extractAgentLoopStats(storage.messages, loopStartTime);
            const trace = messagesToTrace(storage.messages);
            if (trace.length === 0) {
                const errResult: ValidationResult = {
                    testCaseId: tc.id,
                    testCaseIndex: caseIndex,
                    criterionIndex: 0,
                    testInput: input,
                    testCaseCriteria: criteria[0] || '',
                    rawResponse: '',
                    error: t('batch-validation-empty-trace')
                };
                const errGroup: ResultGroup = {
                    testCaseIndex: caseIndex,
                    testInput: input,
                    inputRichContent: tc.inputRichContent,
                    agentMessages: storage.messages,
                    agentLoopStats: agentStats,
                    criterionResults: [errResult]
                };
                const tcArr = tabStorage.testCases;
                if (tcArr && tcArr[caseIndex]) (tcArr[caseIndex] as any).lastResultGroup = errGroup;
                taskLoopRefsByCase.delete(caseIndex);
                const nextErr = new Set(runningCaseIndices.value);
                nextErr.delete(caseIndex);
                runningCaseIndices.value = nextErr;
                return errGroup;
            }
            const testCasesForApi = criteria.map((c, i) => ({
                id: `${tc.id}-c-${i}`,
                expectedCriteria: c
            }));
            const { code, msg } = await bridge.commandRequest('batch-validation/run', {
                messages: trace,
                testCases: testCasesForApi,
                evaluationMode: tc.evaluationMode ?? 'pass-fail',
                llmConfig
            });
            if (code === 200 && msg?.results) {
                const apiResults = msg.results as Array<{
                    testCaseId: string;
                    testCaseCriteria: string;
                    rawResponse: string;
                    pass?: boolean;
                    reason?: string;
                    score?: number;
                    error?: string;
                    evalInputTokens?: number;
                    evalOutputTokens?: number;
                }>;
                const criterionResults: ValidationResult[] = apiResults.map((r, cIdx) => ({
                    testCaseId: r.testCaseId,
                    testCaseIndex: caseIndex,
                    criterionIndex: cIdx,
                    testInput: input,
                    testCaseCriteria: r.testCaseCriteria,
                    rawResponse: r.rawResponse,
                    pass: r.pass,
                    reason: r.reason,
                    score: r.score,
                    error: r.error,
                    evalInputTokens: r.evalInputTokens,
                    evalOutputTokens: r.evalOutputTokens
                }));
                const successGroup: ResultGroup = {
                    testCaseIndex: caseIndex,
                    testInput: input,
                    inputRichContent: tc.inputRichContent,
                    agentMessages: storage.messages,
                    agentLoopStats: agentStats,
                    criterionResults
                };
                const tcArrS = tabStorage.testCases;
                if (tcArrS && tcArrS[caseIndex]) (tcArrS[caseIndex] as any).lastResultGroup = successGroup;
                taskLoopRefsByCase.delete(caseIndex);
                const nextOk = new Set(runningCaseIndices.value);
                nextOk.delete(caseIndex);
                runningCaseIndices.value = nextOk;
                return successGroup;
            }
            const criterionResults: ValidationResult[] = criteria.map((c, cIdx) => ({
                testCaseId: tc.id,
                testCaseIndex: caseIndex,
                criterionIndex: cIdx,
                testInput: input,
                testCaseCriteria: c,
                rawResponse: '',
                error: String(msg ?? 'Validation failed')
            }));
            const failGroup: ResultGroup = {
                testCaseIndex: caseIndex,
                testInput: input,
                inputRichContent: tc.inputRichContent,
                agentMessages: storage.messages,
                agentLoopStats: agentStats,
                criterionResults
            };
            const tcArrF = tabStorage.testCases;
            if (tcArrF && tcArrF[caseIndex]) (tcArrF[caseIndex] as any).lastResultGroup = failGroup;
            taskLoopRefsByCase.delete(caseIndex);
            const nextFail = new Set(runningCaseIndices.value);
            nextFail.delete(caseIndex);
            runningCaseIndices.value = nextFail;
            return failGroup;
        }

        runStatusText.value = t('batch-validation-status-agent');
        if (comprehensive) {
            const runPromises = casesToRun.map((c) => runSingleCase(c));
            try {
                const groups = await Promise.all(runPromises);
                groupsWithStats.push(...groups);
                for (const g of groups) {
                    for (const r of g.criterionResults) allResults.push(r);
                }
            } catch (e) {
                if (abortRequested.value) {
                    runStatusText.value = '';
                    return;
                }
                throw e;
            }
        } else {
            for (let i = 0; i < casesToRun.length; i++) {
                const group = await runSingleCase(casesToRun[i]);
                groupsWithStats.push(group);
                for (const r of group.criterionResults) allResults.push(r);
                if (abortRequested.value) break;
                runStatusText.value = t('batch-validation-status-eval');
            }
        }

        results.value = allResults;
        resultGroupsWithStats.value = groupsWithStats;
        tabStorage.resultGroups = groupsWithStats;
        runStatusText.value = '';
        ElMessage.success(t('batch-validation-done'));
    } catch (err) {
        ElMessage.error(String(err));
        runStatusText.value = '';
    } finally {
        isRunning.value = false;
        runningCaseIndices.value = new Set();
        taskLoopRefsByCase.clear();
        abortRequested.value = false;
    }
}

watch(chatTabs, (val) => {
    if (val.length > 0) {
        const src = tabStorage.sourceTabIndex ?? 0;
        if (src >= val.length) tabStorage.sourceTabIndex = 0;
    }
}, { immediate: true });

watch(() => tabStorage.testCases?.length ?? 0, (len) => {
    const idx = tabStorage.selectedCaseIndex;
    if (len > 0 && (idx < 0 || idx >= len)) {
        tabStorage.selectedCaseIndex = Math.max(0, len - 1);
    }
}, { immediate: true });

// 批量验证持久化：从 JSON 归档加载（新 tab 或切换到此 tab 时），变更时防抖写入
const bridge = useMessageBridge();
async function loadBatchValidationFromDuckDb() {
    const clientId = mcpClientAdapter.masterNode?.clientId;
    if (!clientId) return;
    const res = await bridge.commandRequest<{ storage: BatchValidationStorage }>('batch-validation/load', { clientId });
    if (res.code === 200 && res.msg?.storage) {
        Object.assign(tab.storage, res.msg.storage);
        ensureBatchValidationStorage(tab.storage);
        const groups = tabStorage.resultGroups ?? [];
        const tcArr = tabStorage.testCases ?? [];
        for (const g of groups) {
            const idx = g.testCaseIndex;
            if (idx >= 0 && idx < tcArr.length && !(tcArr[idx] as any).lastResultGroup) {
                (tcArr[idx] as any).lastResultGroup = g;
            }
        }
        resultGroupsWithStats.value = groups;
    }
}
onMounted(() => {
    loadBatchValidationFromDuckDb();
    window.addEventListener('beforeunload', onBeforeUnload);
});
onUnmounted(() => {
    window.removeEventListener('beforeunload', onBeforeUnload);
});
// 切换到此批量验证 tab 时重新拉取，保证与其它 tab 一致
watch(
    () => tabs.activeIndex === props.tabId,
    (isActive) => {
        if (isActive) loadBatchValidationFromDuckDb();
    }
);

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function flushSave() {
    const clientId = mcpClientAdapter.masterNode?.clientId;
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (!clientId) return;
    bridge.commandRequest('batch-validation/save', {
        clientId,
        storage: {
            testCases: tabStorage.testCases ?? [],
            selectedCaseIndex: tabStorage.selectedCaseIndex ?? 0,
            sourceTabIndex: tabStorage.sourceTabIndex ?? 0,
            resultGroups: tabStorage.resultGroups ?? []
        }
    });
}
function scheduleSaveToDuckDb() {
    const clientId = mcpClientAdapter.masterNode?.clientId;
    if (!clientId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
}

function onBeforeUnload() {
    flushSave();
}

watch(
    () => [
        JSON.stringify(tabStorage.testCases ?? []),
        tabStorage.selectedCaseIndex,
        tabStorage.sourceTabIndex,
        JSON.stringify(tabStorage.resultGroups ?? [])
    ],
    () => scheduleSaveToDuckDb(),
    { deep: true }
);
</script>

<style scoped>
/* 仿 reflux：全屏布局，无 padding，无 max-width；左右用 splitter 可拖拽调整 */
.batch-validation-container {
    height: 100%;
}

.batch-validation-splitter {
    height: 100%;
}

.batch-validation-splitter :deep(.el-splitter__panel) {
    overflow: hidden;
}

.batch-splitter-panel-left {
    display: flex;
    flex-direction: column;
}

.batch-splitter-panel-right {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.batch-right-vertical-splitter {
    height: 100%;
    width: 100%;
}

.batch-right-vertical-splitter :deep(.el-splitter__panel) {
    overflow: hidden;
}

.batch-executor-panel {
    display: flex;
    flex-direction: column;
}

.batch-results-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.batch-results-wrap {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.batch-results-header {
    padding: 12px 16px;
    font-size: 15px;
    border-bottom: 1px solid var(--el-border-color-light);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.batch-results-header-running {
    font-size: 12px;
    opacity: 0.8;
    margin-left: 8px;
}

.batch-results-header-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
}

.batch-results-header-stats {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
    font-size: 13px;
    font-weight: 500;
}

.batch-results-header-stat {
    color: var(--el-text-color-secondary);
}

.batch-results-header-stat.icon-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.batch-results-header-stat-icon {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
}

.batch-results-header-stat-icon.is-up {
    transform: rotate(180deg);
}

.batch-results-header-stat.pass {
    color: var(--el-color-success);
}

.batch-results-header-stat.fail {
    color: var(--el-color-danger);
}

.batch-results-scroll {
    flex: 1;
    min-height: 0;
}

.batch-results-empty {
    padding: 40px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.batch-results-empty-text {
    font-size: 14px;
    color: var(--el-text-color-secondary);
}

.batch-results-body {
    min-height: 100%;
}

.batch-results-content {
    width: 100%;
}


.batch-results-header-loading {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 4px;
    font-size: 13px;
    font-weight: normal;
    color: var(--el-color-primary);
}

.batch-results-loading-spinner {
    flex-shrink: 0;
    color: var(--el-color-primary);
    animation: batch-loading-spin 0.8s linear infinite;
}

@keyframes batch-loading-spin {
    to { transform: rotate(360deg); }
}

.batch-results-loading-text {
    font-size: 13px;
    color: var(--el-color-primary);
}

.batch-log-history {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 860px;
    margin: 0 auto;
    padding: 16px;
}

.batch-log-evaluation {
    margin-top: 12px;
}

.batch-log-eval-item {
    padding: 5px 12px 0;
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter);
    margin-bottom: 8px;
    background: color-mix(in srgb, var(--el-fill-color-blank) 88%, var(--el-fill-color-light));
    border-left-color: var(--el-color-info-light-5);
}

.batch-log-eval-item:last-child {
    margin-bottom: 0;
}

.batch-log-eval-item:has(.result-badge.pass) {
    border-left-color: var(--el-color-success);
}

.batch-log-eval-item:has(.result-badge.fail),
.batch-log-eval-item.error {
    border-left-color: var(--el-color-danger);
}

.batch-log-eval-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
}

.batch-log-eval-index {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-regular);
    line-height: 1.4;
}

.batch-log-eval-tokens {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    font-size: 12px;
    color: var(--el-text-color-secondary);
}
.batch-log-eval-tokens-label {
    font-weight: 500;
}
.batch-log-eval-tokens-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.batch-log-eval-tokens-icon {
    font-size: 12px;
}
.batch-log-eval-tokens-icon.is-up {
    transform: rotate(180deg);
}

.batch-log-eval-reason {
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
    word-break: break-word;
    border: 1px solid var(--el-border-color-light);
}

/* 左侧列表 */
.batch-list-panel {
    width: 100%;
    height: 100%;
    border-right: 1px solid var(--el-border-color-light);
    background-color: var(--el-bg-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.batch-list-panel .list-header {
    padding: 12px 10px;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

.batch-list-panel .list-add-btn-wrap {
    margin: 3px;
    width: calc(100% - 6px);
}

.batch-list-panel .list-header-btn-group {
    width: 100%;
    display: flex;
}

.batch-list-panel .list-header-btn-group .list-add-btn {
    flex: 1;
    display: flex;
    align-items: center;
    padding-left: 12px;
    border-radius: 8px 0 0 8px;
    border: 1px solid var(--window-button-active);
}

.batch-list-panel .list-comprehensive-btn {
    flex: 1;
}

.batch-list-panel .list-comprehensive-btn .list-comprehensive-btn-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.batch-list-panel .list-delete-btn {
    flex-shrink: 0;
    border: 1px solid var(--window-button-active) !important;
}

.batch-list-panel .list-container {
    flex: 1;
    min-height: 0;
}

.batch-list-panel .list-container .el-scrollbar {
    height: 100%;
}

.batch-list-panel .list-inner {
    padding: 10px;
}

.batch-list-panel .list-item {
    margin: 3px;
    padding: 5px 10px;
    border-radius: 0.3em;
    user-select: none;
    cursor: pointer;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    transition: var(--animation-3s);
}

.list-add-btn-text {
    margin-left: 8px;
}

.detail-actions-right {
    display: flex;
    gap: 8px;
}

.batch-list-panel .list-item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.batch-list-panel .list-item-checkbox {
    flex-shrink: 0;
    margin-right: 2px;
}

.batch-list-panel .list-item-checkbox .el-checkbox__inner {
    width: 16px;
    height: 16px;
}

.batch-list-panel .list-item-setting-btn {
    flex-shrink: 0;
    padding: 4px;
}

.batch-list-panel .list-item-setting-btn .iconfont {
    margin: 0;
}

.batch-list-panel .list-item-result-bar {
    width: 5px;
    min-width: 5px;
    align-self: stretch;
    border-radius: 0.2em;
    background: var(--el-bg-color);
}

.batch-list-panel .list-item-result-bar.has-result {
    background: linear-gradient(
        to bottom,
        var(--batch-result-pass, #67c23a) 0,
        var(--batch-result-pass, #67c23a) var(--pass-pct, 100%),
        var(--batch-result-fail, #f56c6c) var(--pass-pct, 100%),
        var(--batch-result-fail, #f56c6c) 100%
    );
}

@keyframes batch-result-bar-color-flow {
    0%, 100% { background: var(--main-light-color-70); }
    50% { background: var(--main-light-color-10); }
}

.batch-list-panel .list-item-result-bar.is-running {
    animation: batch-result-bar-color-flow 1.5s ease-in-out infinite;
}

.batch-list-panel .list-item:hover {
    background-color: var(--el-fill-color-light);
}

.batch-list-panel .list-item.active {
    background-color: var(--el-fill-color-light);
    border-left: 3px solid var(--el-color-primary-light-5);
}

.batch-list-panel .item-title {
    font-weight: bold;
    font-size: 13px;
    max-width: 100%;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.batch-list-panel .item-preview,
.batch-list-panel .item-empty {
    font-size: 12.5px;
    opacity: 0.6;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.batch-list-panel .list-empty {
    padding: 10px;
    font-size: 12.5px;
    opacity: 0.6;
}

/* 右侧详情 */
.batch-detail-panel {
    width: 100%;
    height: 100%;
    min-width: 0;
    flex: 1;
    background-color: var(--el-bg-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.batch-detail-panel .detail-actions-top {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.batch-detail-panel .detail-actions-top .detail-actions-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.batch-detail-panel .detail-actions-top .detail-actions-row .detail-name-input {
    flex: 1;
    min-width: 0;
}

/* 设置 + 执行验证 按钮组 */
.batch-detail-panel .detail-run-btn-group {
    display: inline-flex;
}

.batch-detail-panel .detail-run-btn-group .el-button:first-child {
    border-top-left-radius: 8px !important;
    border-bottom-left-radius: 8px !important;
}

.batch-detail-panel .detail-run-btn-group .el-button:last-child {
    border-top-right-radius: 8px !important;
    border-bottom-right-radius: 8px !important;
}

.batch-detail-panel .detail-run-btn-group .detail-setting-btn {
    border: 1px solid var(--window-button-active);
    background-color: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
}

.batch-detail-panel .detail-run-btn-group .detail-setting-btn:hover {
    border-color: var(--el-border-color-hover);
    background-color: var(--main-light-color-50);
    color: var(--el-text-color-primary);
}

/* 执行验证按钮：与 list-add-btn hover 一致，hover 时颜色 +20 */
.batch-detail-panel .detail-run-btn-group .detail-run-btn {
    border: 1px solid var(--main-light-color-70) !important;
    background-color: var(--main-light-color-20) !important;
    color: var(--el-text-color-primary) !important;
}

.batch-detail-panel .detail-run-btn-group .detail-run-btn:hover:not(:disabled) {
    border-color: var(--main-light-color-90) !important;
    background-color: var(--main-light-color-40) !important;
}

.batch-detail-panel .detail-run-btn-group .detail-run-btn .shortcut-hint {
    margin-left: 6px;
    opacity: 0.65;
    font-weight: 400;
    font-size: 12px;
}

.batch-detail-panel .detail-run-btn-group .detail-run-btn .iconfont {
    margin-right: 6px;
}

/* 从右往左拉出的配置抽屉 */
.settings-drawer-mask {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: flex-end;
}

.settings-drawer-panel {
    width: 360px;
    max-width: 100%;
    height: 100%;
    background: var(--el-bg-color);
    box-shadow: -2px 0 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.settings-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--el-border-color-light);
    flex-shrink: 0;
}

.settings-drawer-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.settings-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
}

.settings-drawer-section {
    margin-bottom: 20px;
}

.settings-drawer-section-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-regular);
    margin-bottom: 10px;
}

.settings-drawer-mode-select {
    width: 100%;
}

/* 抽屉从右往左滑入 */
.settings-drawer-enter-active .settings-drawer-panel,
.settings-drawer-leave-active .settings-drawer-panel {
    transition: transform 0.25s ease;
}

.settings-drawer-enter-from .settings-drawer-panel,
.settings-drawer-leave-to .settings-drawer-panel {
    transform: translateX(100%);
}

.settings-drawer-enter-active .settings-drawer-mask,
.settings-drawer-leave-active .settings-drawer-mask {
    transition: opacity 0.25s ease;
}

.settings-drawer-enter-from,
.settings-drawer-leave-to {
    opacity: 0;
}

.batch-detail-panel .detail-status {
    margin-top: 8px;
    font-size: 13px;
    color: var(--main-color);
}

.batch-detail-panel .detail-hint {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

.batch-detail-panel .el-scrollbar {
    height: 100%;
}

.batch-detail-panel .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    gap: 16px;
}

.batch-detail-panel .no-selection.add-prompt {
    flex-direction: column;
}

.batch-detail-panel .detail-content {
    padding: 20px;
}

.batch-detail-panel .detail-section {
    margin-bottom: 16px;
}

/* 描述、输入、评价标准等区块标题的独立样式 */
.batch-detail-panel .detail-section-label {
    display: block;
    font-size: 15px;
    font-weight: 500;
    color: var(--el-text-color-regular);
    margin-bottom: 8px;
}

.batch-detail-panel .detail-score-type {
    font-size: 14px;
    color: var(--el-text-color-primary);
}

.batch-detail-panel .detail-results {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--el-border-color-light);
}

.batch-detail-panel .detail-results h4 {
    margin: 0 0 12px;
    font-size: 14px;
}


.result-panel {
    overflow: auto;
}


.card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.test-cases-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.test-case-group {
    padding: 12px;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    background: var(--sidebar);
}

.tc-group-header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--sidebar-border);
}

.tc-input-row,
.tc-criteria-row {
    margin-bottom: 10px;
}

.tc-input-row label,
.tc-criteria-row label {
    display: block;
    font-size: 12px;
    margin-bottom: 4px;
    color: var(--sidebar-item-text);
}

.tc-input-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

/* 与左侧列表「添加」按钮样式完全一致 */
.add-criterion-btn {
    margin-top: 4px;
    width: fit-content;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding-left: 12px;
    border-radius: 8px;
    border: 1px solid var(--vline-stroke-color);
}

.add-criterion-btn:hover {
    color: var(--main-light-color-70) !important;
    border: 1px solid var(--main-light-color-70);
    background-color: var(--main-light-color-20);
}

.add-criterion-btn .iconfont {
    margin-right: 8px;
}

.criterion-item {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 6px;
}

.criterion-item .el-input {
    flex: 1;
}

.empty-hint {
    font-size: 13px;
    color: var(--sidebar-item-text);
}

.results-card {
    flex: 1;
    min-height: 0;
}

.results-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 450px;
    overflow-y: auto;
}

.result-item {
    padding: 12px;
    border-radius: 8px;
    background: var(--sidebar);
    border: 1px solid var(--sidebar-border);
}

.result-item.error {
    border-color: var(--el-color-danger);
}

.result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}

.result-index {
    font-weight: 600;
}

.result-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
}

.result-badge.pass {
    color: var(--el-color-success);
}

.result-badge.fail {
    color: var(--el-color-danger);
}

.result-badge.unknown {
    background: var(--el-color-info-light-9);
    color: var(--el-color-info);
}

.result-score {
    font-weight: 600;
}

.result-input {
    font-size: 12px;
    margin-bottom: 4px;
    color: var(--main-color);
    white-space: pre-wrap;
}

.result-criteria {
    font-size: 13px;
    margin-bottom: 4px;
    color: var(--sidebar-item-text);
}

.result-error {
    font-size: 12px;
    color: var(--el-color-danger);
}

.result-raw {
    font-size: 12px;
    color: var(--foreground);
    white-space: pre-wrap;
}

.ctrl {
    margin-left: 5px;
    opacity: 0.6;
}

.detail-run-btn .iconfont {
    color: var(--main-color);
}
</style>
