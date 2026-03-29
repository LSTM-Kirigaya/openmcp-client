<template>
    <div class="test-cases-container">
        <div class="test-cases-header">
            <h3>
                <span class="iconfont icon-tool"></span>
                {{ t('test-cases-management') }}
            </h3>
            <el-tag v-if="cloudContext.mode === 'cloud'" type="warning">
                {{ t('runtime-mode-cloud') }}
            </el-tag>
            <div class="header-actions">
                <el-select v-model="statusFilter" class="header-status-filter" :placeholder="t('filter-by-status')"
                    style="width: 110px;">
                    <el-option :label="t('filter-all')" value="all" />
                    <el-option :label="t('test-passed')" value="passed" />
                    <el-option :label="t('test-failed')" value="failed" />
                    <el-option :label="t('test-timeout')" value="timeout" />
                </el-select>
                <el-switch
                    v-model="tabStorage.showOnlyCurrentToolTestCases"
                    :active-text="t('show-only-current-tool')"
                    class="header-switch"
                />
                <el-button-group class="header-button-group">
                    <el-tooltip :content="t('create-test-case')" placement="top">
                        <el-button size="default" @click="handleCreateTestCase" class="btn-secondary btn-create">
                            <span class="iconfont icon-add"></span>
                        </el-button>
                    </el-tooltip>
                    <el-tooltip :content="t('run-all-tests')" placement="top">
                        <el-button size="default" @click="handleRunAllTests" :loading="runningAll" type="primary" class="btn-run-all">
                            <span class="iconfont icon-play"></span>
                        </el-button>
                    </el-tooltip>
                </el-button-group>
            </div>
        </div>
        <div v-if="cloudContext.mode === 'cloud' && !cloudContext.currentProjectId" class="no-test-cases-text">
            {{ t('cloud-select-project-first') }}
        </div>

        <div class="test-cases-list">
            <el-scrollbar height="100%">
                <div v-if="testCases.length === 0" class="no-test-cases-text">{{ t('no-test-cases') }}</div>
                <div v-else class="test-case-items">
                    <div v-for="testCase in testCases" :key="testCase.id" class="test-case-item"
                        :class="{ 'active': selectedTestCase?.id === testCase.id }">
                        <div class="test-case-header">
                            <div class="test-case-info">
                                <el-tag :type="getStatusTagType(testCase.status)" class="status-tag">
                                    {{ getStatusText(testCase.status) }}
                                </el-tag>
                                <span class="test-case-name">{{ testCase.name }}</span>
                                <span class="test-case-tool">{{ testCase.toolName }}</span>
                            </div>
                            <div class="test-case-actions">
                                <el-button-group>
                                    <el-tooltip :content="t('run-test')" placement="top">
                                        <el-button type="primary" circle @click.stop="handleRunTest(testCase)"
                                            :loading="testCase.status === 'running'" class="btn-run">
                                            <span class="iconfont icon-play"></span>
                                        </el-button>
                                    </el-tooltip>
                                    <el-tooltip v-if="testCase.actualOutput" :content="t('view-result')" placement="top">
                                        <el-button circle @click.stop="selectTestCase(testCase)" class="btn-view">
                                            <span class="iconfont icon-wendang"></span>
                                        </el-button>
                                    </el-tooltip>
                                    <el-tooltip :content="t('edit-test-case')" placement="top">
                                        <el-button circle @click.stop="handleEditTestCase(testCase)"
                                            class="btn-edit">
                                            <span class="iconfont icon-edit"></span>
                                        </el-button>
                                    </el-tooltip>
                                    <el-popconfirm :title="t('confirm-delete-test-case')"
                                        @confirm="handleDeleteTestCase(testCase.id)">
                                        <template #reference>
                                            <el-tooltip :content="t('delete-test-case')" placement="top">
                                                <el-button type="danger" circle @click.stop class="btn-delete">
                                                    <span class="iconfont icon-delete"></span>
                                                </el-button>
                                            </el-tooltip>
                                        </template>
                                    </el-popconfirm>
                                </el-button-group>
                            </div>
                        </div>
                        <div class="test-case-description" v-if="testCase.description">
                            {{ testCase.description }}
                        </div>
                        <div class="test-case-time">
                            {{ t('updated-at') }}: {{ formatTime(testCase.updatedAt) }}
                        </div>
                    </div>
                </div>
            </el-scrollbar>
        </div>

        <!-- 测试用例详情/编辑对话框 -->
        <el-dialog v-model="dialogVisible" :title="isEditing ? t('edit-test-case') : t('create-test-case')" width="60%"
            :close-on-click-modal="false" class="test-case-dialog">
            <el-form :model="currentTestCaseForm" label-position="top" ref="formRef">
                <el-form-item :label="t('test-case-name')" required>
                    <el-input v-model="currentTestCaseForm.name" :placeholder="t('enter-test-case-name')" />
                </el-form-item>
                <el-form-item :label="t('tool-name')" required>
                    <el-select v-model="currentTestCaseForm.toolName" :placeholder="t('select-tool')"
                        @change="handleToolChange" style="width: 100%">
                        <el-option v-for="tool in availableTools" :key="tool.name" :label="tool.name"
                            :value="tool.name" />
                    </el-select>
                </el-form-item>
                <el-form-item :label="t('description')">
                    <el-input v-model="currentTestCaseForm.description" type="textarea" :rows="2"
                        :placeholder="t('enter-description')" />
                </el-form-item>
                <el-form-item :label="t('input-parameters')" required>
                    <div class="json-editor">
                        <el-input v-model="inputJson" type="textarea" :rows="8" :placeholder="t('enter-json-input')" />
                        <el-button-group class="json-editor-actions">
                            <el-tooltip :content="t('format-json')" placement="top">
                                <el-button @click="formatInputJson" class="btn-secondary btn-format">
                                    <span class="iconfont icon-refresh"></span>
                                </el-button>
                            </el-tooltip>
                            <el-tooltip :content="t('copy-from-executor')" placement="top">
                                <el-button @click="copyFromCurrentForm" class="btn-secondary btn-copy">
                                    <span class="iconfont icon-copy"></span>
                                </el-button>
                            </el-tooltip>
                        </el-button-group>
                    </div>
                </el-form-item>
                <el-form-item :label="t('expected-output')">
                    <div class="json-editor">
                        <el-input v-model="expectedJson" type="textarea" :rows="8"
                            :placeholder="t('enter-json-input')" />
                        <el-button-group class="json-editor-actions">
                            <el-tooltip :content="t('format-json')" placement="top">
                                <el-button @click="formatExpectedJson" class="btn-secondary btn-format">
                                    <span class="iconfont icon-refresh"></span>
                                </el-button>
                            </el-tooltip>
                        </el-button-group>
                    </div>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button-group class="dialog-footer-group">
                    <el-button @click="dialogVisible = false" class="btn-secondary btn-cancel">
                        {{ t('cancel') }}
                    </el-button>
                    <el-button type="primary" @click="handleSaveTestCase" class="btn-save">
                        {{ t('save') }}
                    </el-button>
                </el-button-group>
            </template>
        </el-dialog>

        <!-- 测试结果详情对话框 -->
        <el-dialog v-model="resultDialogVisible" :title="t('test-result-details')" width="70%" class="test-result-dialog">
            <div v-if="selectedTestCase" class="test-result-container">
                <div class="result-section">
                    <h4>{{ t('input-parameters') }}</h4>
                    <pre class="json-display">{{ JSON.stringify(selectedTestCase.input, null, 2) }}</pre>
                </div>
                <div class="result-section">
                    <h4>{{ t('actual-output') }}</h4>
                    <pre class="json-display">{{ JSON.stringify(selectedTestCase.actualOutput, null, 2) }}</pre>
                </div>
                <div class="result-section">
                    <h4>{{ t('expected-output') }}</h4>
                    <pre class="json-display">{{ JSON.stringify(selectedTestCase.expectedOutput, null, 2) }}</pre>
                </div>
            </div>
            <template #footer>
                <el-button @click="resultDialogVisible = false" class="btn-secondary btn-close">
                    {{ t('close') }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, type FormInstance } from 'element-plus';
import { tabs } from '../../../panel';
import type { ToolStorage, TestCase } from '../../tools';
import { mcpClientAdapter } from '@/views/connect/core';
import { cloudContext } from '@/hook/cloud-context';
import {
    createTestCase,
    deleteTestCase,
    initTestCasesStore,
    loadTestCases,
    testCasesState,
    updateTestCase
} from './store';

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ToolStorage;

// 初始化 server 级测试用例存储
try { initTestCasesStore(mcpClientAdapter.masterNode); } catch { /* 已初始化忽略 */ }

/** 状态筛选：全部 | 成功 | 失败 | 超时 */
const statusFilter = ref<'all' | 'passed' | 'failed' | 'timeout'>('all');

const testCases = computed(() => {
    let list = testCasesState.value || [];
    const onlyCurrent = !!tabStorage.showOnlyCurrentToolTestCases;
    const current = tabStorage.currentToolName;
    if (onlyCurrent && current) {
        list = list.filter(tc => tc.toolName === current);
    }
    if (statusFilter.value !== 'all') {
        list = list.filter(tc => tc.status === statusFilter.value);
    }
    return list;
});
const selectedTestCase = ref<TestCase | null>(null);
const dialogVisible = ref(false);
const resultDialogVisible = ref(false);
const isEditing = ref(false);
const runningAll = ref(false);
const formRef = ref<FormInstance>();

interface TestCaseForm {
    name: string;
    toolName: string;
    description?: string;
    input: Record<string, any>;
}

const currentTestCaseForm = ref<TestCaseForm>({
    name: '',
    toolName: '',
    description: '',
    input: {}
});

const inputJson = ref('{}');
const expectedJson = ref('');

// 获取所有可用的工具
const availableTools = computed(() => {
    const tools: Array<{ name: string; description?: string }> = [];
    for (const client of mcpClientAdapter.clients) {
        if (client.tools) {
            for (const tool of client.tools.values()) {
                tools.push({
                    name: tool.name,
                    description: tool.description
                });
            }
        }
    }
    return tools;
});

function selectTestCase(testCase: TestCase) {
    selectedTestCase.value = testCase;
    resultDialogVisible.value = true;
}

function handleCreateTestCase() {
    isEditing.value = false;
    currentTestCaseForm.value = {
        name: '',
        toolName: tabStorage.currentToolName || '',
        description: '',
        input: {}
    };
    inputJson.value = '{}';
    expectedJson.value = '';
    dialogVisible.value = true;
}

function handleEditTestCase(testCase: TestCase) {
    isEditing.value = true;
    currentTestCaseForm.value = {
        name: testCase.name,
        toolName: testCase.toolName,
        description: testCase.description,
        input: { ...testCase.input }
    };
    inputJson.value = JSON.stringify(testCase.input, null, 2);
    expectedJson.value = testCase.expectedOutput ? JSON.stringify(testCase.expectedOutput, null, 2) : '';
    selectedTestCase.value = testCase;
    dialogVisible.value = true;
}

function handleToolChange() {
    // 工具变更时重置输入
    inputJson.value = '{}';
}

function formatInputJson() {
    try {
        const parsed = JSON.parse(inputJson.value);
        inputJson.value = JSON.stringify(parsed, null, 2);
        ElMessage.success(t('format-success'));
    } catch (e) {
        ElMessage.error(t('invalid-json'));
    }
}

function formatExpectedJson() {
    try {
        if (!expectedJson.value || expectedJson.value.trim() === '') {
            expectedJson.value = '';
            ElMessage.success(t('format-success'));
            return;
        }
        const parsed = JSON.parse(expectedJson.value);
        expectedJson.value = JSON.stringify(parsed, null, 2);
        ElMessage.success(t('format-success'));
    } catch (e) {
        ElMessage.error(t('invalid-json'));
    }
}

function copyFromCurrentForm() {
    try {
        inputJson.value = JSON.stringify(tabStorage.formData, null, 2);
        ElMessage.success(t('copied-from-executor'));
    } catch (e) {
        ElMessage.error(t('copy-failed'));
    }
}

function getFriendlyCloudErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (/401|unauthorized|token|expired|鉴权|未授权/i.test(message)) {
        return '云端登录已过期，请先刷新令牌或重新登录后再试。';
    }
    return message || t('error');
}

async function handleSaveTestCase() {
    // 验证
    if (!currentTestCaseForm.value.name) {
        ElMessage.error(t('please-enter-test-case-name'));
        return;
    }
    if (!currentTestCaseForm.value.toolName) {
        ElMessage.error(t('please-select-tool'));
        return;
    }

    // 解析输入 JSON
    let parsedInput: Record<string, any>;
    try {
        parsedInput = JSON.parse(inputJson.value);
    } catch (e) {
        ElMessage.error(t('invalid-input-json'));
        return;
    }

    // 解析预期输出 JSON（可选）
    let parsedExpected: any | undefined = undefined;
    if (expectedJson.value && expectedJson.value.trim() !== '') {
        try {
            parsedExpected = JSON.parse(expectedJson.value);
        } catch (e) {
            ElMessage.error(t('invalid-input-json'));
            return;
        }
    }

    const now = Date.now();

    try {
        if (isEditing.value && selectedTestCase.value) {
            await updateTestCase(selectedTestCase.value.id, {
                name: currentTestCaseForm.value.name,
                toolName: currentTestCaseForm.value.toolName,
                description: currentTestCaseForm.value.description,
                input: parsedInput,
                expectedOutput: parsedExpected,
                updatedAt: now
            });
            ElMessage.success(t('test-case-updated'));
        } else {
            // 创建新测试用例
            const newTestCase: TestCase = {
                id: `test_${now}_${Math.random().toString(36).substr(2, 9)}`,
                name: currentTestCaseForm.value.name,
                toolName: currentTestCaseForm.value.toolName,
                description: currentTestCaseForm.value.description,
                input: parsedInput,
                status: 'pending',
                createdAt: now,
                updatedAt: now,
                ...(parsedExpected !== undefined ? { expectedOutput: parsedExpected } : {})
            };
            await createTestCase(newTestCase);
            ElMessage.success(t('test-case-created'));
        }

        dialogVisible.value = false;
    } catch (error) {
        ElMessage.error(getFriendlyCloudErrorMessage(error));
    }
}

async function handleDeleteTestCase(id: string) {
    await deleteTestCase(id);
    ElMessage.success(t('test-case-deleted'));
}

async function handleRunTest(testCase: TestCase) {
    await updateTestCase(testCase.id, { status: 'running' }, { persist: false });
    try {
        const response = await mcpClientAdapter.callTool(testCase.toolName, testCase.input);

        // 无预期输出时，工具调用成功即视为通过；有预期输出时进行比对
        const hasExpected = testCase.expectedOutput !== undefined && testCase.expectedOutput !== null;
        const isMatch = !hasExpected || isToolCallResponseEqual(response, testCase.expectedOutput);
        const newStatus = isMatch ? 'passed' : 'failed';

        await updateTestCase(testCase.id, {
            status: newStatus,
            actualOutput: response,
            updatedAt: Date.now()
        }, { persist: false });
        ElMessage.success(t('test-executed-successfully'));

        if (!runningAll.value) {
            selectedTestCase.value = testCasesState.value.find(tc => tc.id === testCase.id) ?? testCase;
            resultDialogVisible.value = true;
        }
    } catch (e: any) {
        const errMsg = e?.message ?? String(e);
        const isTimeout = /timeout|timed out|ETIMEDOUT/i.test(errMsg);
        await updateTestCase(testCase.id, {
            status: isTimeout ? 'timeout' : 'failed',
            actualOutput: {
                content: [{ type: 'text', text: `Error: ${errMsg}` }],
                isError: true
            },
            updatedAt: Date.now()
        }, { persist: false });
        ElMessage.error(t('test-execution-failed'));

        if (!runningAll.value) {
            selectedTestCase.value = testCasesState.value.find(tc => tc.id === testCase.id) ?? testCase;
            resultDialogVisible.value = true;
        }
    }
}

/** 比较两次工具调用结果是否等价（忽略键序等差异） */
function isToolCallResponseEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    const aStr = JSON.stringify(normalizeToolCallResponse(a));
    const bStr = JSON.stringify(normalizeToolCallResponse(b));
    return aStr === bStr;
}

function normalizeToolCallResponse(r: any): any {
    if (!r || typeof r !== 'object') return r;
    return {
        isError: !!r.isError,
        content: Array.isArray(r.content)
            ? r.content.map((c: any) => ({ type: c?.type ?? 'text', text: c?.text ?? '' }))
            : []
    };
}

async function handleRunAllTests() {
    runningAll.value = true;
    let passed = 0;
    let failed = 0;

    for (const testCase of testCasesState.value) {
        await handleRunTest(testCase);
        const updated = testCasesState.value.find(tc => tc.id === testCase.id);
        const status = updated?.status ?? testCase.status;
        if (status === 'passed') passed++;
        else if (status === 'failed' || status === 'timeout') failed++;
    }

    runningAll.value = false;
    ElMessage.success(`${t('all-tests-completed')}: ${passed} ${t('passed')}, ${failed} ${t('failed')}`);
}

function getStatusTagType(status?: string): '' | 'success' | 'warning' | 'danger' | 'info' {
    switch (status) {
        case 'passed': return 'success';
        case 'failed': return 'danger';
        case 'timeout': return 'warning';
        case 'running': return 'warning';
        default: return 'info';
    }
}

function getStatusText(status?: string): string {
    switch (status) {
        case 'passed': return t('test-passed');
        case 'failed': return t('test-failed');
        case 'timeout': return t('test-timeout');
        case 'running': return t('test-running');
        default: return t('test-pending');
    }
}

function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

watch(
    () => [cloudContext.mode, cloudContext.currentProjectId],
    () => {
        loadTestCases();
    }
);

</script>

<style scoped>
.test-cases-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 10px;
    padding-bottom: 20px;
    border-radius: 0.5em;
    background-color: var(--background);
    min-height: 0;
}

.test-cases-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

.test-cases-header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.header-switch {
    margin-right: 4px;
}

.test-cases-container .header-switch .el-switch__core {
    border: 1px solid var(--main-color) !important;
    width: 60px !important;
}

.test-cases-container .header-switch .el-switch .el-switch__action {
    background-color: var(--main-color);
}

.test-cases-container .header-switch .el-switch.is-checked .el-switch__action {
    background-color: var(--sidebar);
}

/* 与工具调试 run-debug 按钮组一致：次要按钮 + 主按钮，首尾 8px 圆角 */
.header-button-group {
    display: inline-flex;
}

.header-button-group .btn-secondary {
    border-radius: 0;
    border-color: var(--el-border-color);
    background-color: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
}

.header-button-group .btn-secondary:hover:not(:disabled) {
    border-color: var(--el-border-color-hover);
    background-color: var(--main-light-color-50);
    color: var(--el-text-color-primary);
}

.header-button-group > *:first-child .el-button {
    border-top-left-radius: 8px !important;
    border-bottom-left-radius: 8px !important;
}

.header-button-group .btn-run-all {
    border-top-right-radius: 8px !important;
    border-bottom-right-radius: 8px !important;
    padding-left: 16px;
    padding-right: 16px;
    font-weight: 600;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.test-cases-list {
    flex: 1;
    overflow: hidden;
}

.no-test-cases-text {
    padding: 24px 16px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    text-align: center;
}

.test-case-items {
    padding: 8px 0;
}

/* 与 tool-logger output-content / tool-call-block 风格一致 */
.test-case-item {
    background-color: var(--sidebar);
    border-radius: 0.5em;
    padding: 10px 12px;
    margin-bottom: 10px;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
    border: 1px solid transparent;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.test-case-item:hover {
    background-color: var(--el-fill-color-light);
}

.test-case-item:active {
    transform: scale(0.98);
    transition: transform 0.08s;
}

.test-case-item.active {
    background-color: var(--el-fill-color-light);
    border-left: 3px solid var(--el-text-color-regular);
}

.test-case-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.test-case-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
}

.status-tag {
    flex-shrink: 0;
}

.test-case-name {
    font-weight: bold;
    font-size: 15px;
}

.test-case-tool {
    opacity: 0.7;
    font-size: 13px;
    background-color: var(--main-color);
    padding: 2px 8px;
    border-radius: 0.3em;
    color: black;
}

.test-case-actions {
    margin-left: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.test-case-actions .el-button-group {
    display: inline-flex;
}

/* 与工具调试 executor-actions 次要按钮风格一致 */
.test-case-actions .btn-edit,
.test-case-actions .btn-view {
    border-color: var(--el-border-color);
    background-color: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
}

.test-case-actions .btn-edit:hover,
.test-case-actions .btn-view:hover {
    border-color: var(--el-border-color-hover);
    background-color: var(--main-light-color-50);
    color: var(--el-text-color-primary);
}

.test-case-actions .btn-run {
    border-color: var(--main-color);
    background-color: var(--main-color);
    color: var(--sidebar);
}

.test-case-actions .btn-run:hover:not(:disabled) {
    opacity: 0.9;
}

.test-case-actions .btn-delete:hover {
    opacity: 0.9;
}

.test-case-description {
    opacity: 0.8;
    font-size: 13px;
    margin-bottom: 5px;
}

.test-case-time {
    opacity: 0.6;
    font-size: 12px;
}

.json-editor {
    width: 100%;
}

.json-editor-actions {
    margin-top: 8px;
    display: inline-flex;
}

/* 与工具调试 executor-actions 次要按钮组一致 */
.json-editor .btn-secondary {
    border-radius: 0;
    border-color: var(--el-border-color);
    background-color: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
}

.json-editor .btn-secondary:hover:not(:disabled) {
    border-color: var(--el-border-color-hover);
    background-color: var(--main-light-color-50);
    color: var(--el-text-color-primary);
}

.json-editor-actions > *:first-child .el-button {
    border-top-left-radius: 8px !important;
    border-bottom-left-radius: 8px !important;
}

.json-editor-actions > *:last-child .el-button {
    border-top-right-radius: 8px !important;
    border-bottom-right-radius: 8px !important;
}

/* 编辑/创建对话框底部：与工具调试 footer 按钮组一致 */
.test-cases-container :deep(.test-case-dialog .el-dialog__footer) .dialog-footer-group {
    display: inline-flex;
}

.test-cases-container :deep(.test-case-dialog .el-dialog__footer) .btn-secondary {
    border-radius: 0;
    border-color: var(--el-border-color);
    background-color: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
}

.test-cases-container :deep(.test-case-dialog .el-dialog__footer) .btn-secondary:hover:not(:disabled) {
    border-color: var(--el-border-color-hover);
    background-color: var(--main-light-color-50);
    color: var(--el-text-color-primary);
}

.test-cases-container :deep(.test-case-dialog .el-dialog__footer) .dialog-footer-group > *:first-child .el-button {
    border-top-left-radius: 8px !important;
    border-bottom-left-radius: 8px !important;
}

.test-cases-container :deep(.test-case-dialog .el-dialog__footer) .btn-save {
    border-top-right-radius: 8px !important;
    border-bottom-right-radius: 8px !important;
    padding-left: 20px;
    padding-right: 20px;
    font-weight: 600;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.test-cases-container :deep(.test-result-dialog .el-dialog__footer) .btn-close {
    border-radius: 8px;
    border-color: var(--el-border-color);
    background-color: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
}

.test-cases-container :deep(.test-result-dialog .el-dialog__footer) .btn-close:hover:not(:disabled) {
    border-color: var(--el-border-color-hover);
    background-color: var(--main-light-color-50);
    color: var(--el-text-color-primary);
}

.test-result-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.result-section h4 {
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--el-text-color-regular);
}

.json-display {
    background-color: var(--sidebar);
    padding: 12px 15px;
    border-radius: 0.5em;
    overflow-x: auto;
    font-size: 13px;
    font-family: var(--code-font-family, monospace);
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

:deep(.el-button) {
    transition: transform 0.08s;
}

:deep(.el-button:active) {
    transform: scale(0.95);
}
</style>