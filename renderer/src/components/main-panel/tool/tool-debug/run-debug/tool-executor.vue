<template>
    <div style="padding: 10px;">
        <div class="tool-executor-header">
            <span class="tool-executor-header-label">{{ t('select-tool-to-debug') }}</span>
            <el-tree-select v-model="selectedToolValue" :data="toolTreeData" :render-after-expand="false"
                :placeholder="t('select-tool')" :render-content="renderToolSelectContent"
                popper-class="tool-tree-select-dropdown" class="tool-tree-select" />
        </div>
        <div class="tool-executor-container">
            <el-form :model="tabStorage.formData" :rules="formRules" ref="formRef" label-position="top">
                <template v-if="currentTool?.inputSchema?.properties">
                    <el-form-item v-for="[name, property] in Object.entries(currentTool.inputSchema.properties)"
                        :key="name" :label="property.type === 'string' ? undefined : (property.title || name)" :prop="name"
                        :required="currentTool.inputSchema.required?.includes(name)">

                        <template v-if="property.type === 'string'" #label>
                            <div class="param-label-row">
                                <span class="param-label-text">{{ property.title || name }}</span>
                                <VariableSelector button-text="插入变量" size="small" :tool-name="currentTool?.name || ''"
                                    :parameter-name="name" expected-type="string"
                                    @select="(variable, value) => onVariableSelected(name, variable, value)" />
                            </div>
                        </template>
                        <template v-if="property.type === 'string'">
                            <el-input v-model="tabStorage.formData[name]" type="textarea" :rows="3"
                                :placeholder="property.description || t('enter') + ' ' + (property.title || name)"
                                @keydown="onTextareaKeydown" />
                        </template>

                        <el-input-number v-else-if="property.type === 'number' || property.type === 'integer'"
                            v-model="tabStorage.formData[name]" controls-position="right"
                            :placeholder="property.description || t('enter') + ' ' + (property.title || name)"
                            @keydown.enter.prevent="handleExecute" />

                        <el-switch v-else-if="property.type === 'boolean'" active-text="true" inactive-text="false"
                            v-model="tabStorage.formData[name]" />

                        <k-input-object v-else-if="property.type === 'object' || property.type === 'array'"
                            v-model="tabStorage.formData[name]" :schema="property"
                            :placeholder="property.description || t('enter') + ' ' + (property.title || name)" />

                    </el-form-item>
                </template>
            </el-form>
            <el-dialog v-model="aiPromptVisible" :title="t('edit-ai-mock-prompt')" width="360px" class="ai-mock-dialog"
                destroy-on-close>
                <div class="ai-config-panel">
                    <el-input type="textarea" v-model="aiMookPrompt" :rows="3" :placeholder="t('enter-message-dot')"
                        class="mb-3" />
                    <div class="panel-footer">
                        <div class="flex-center">
                            <el-switch v-model="enableXmlWrapper" size="small" />
                            <span class="label-text">XML</span>
                        </div>
                    </div>
                </div>
                <template #footer>
                    <el-button @click="aiPromptVisible = false">{{ t('cancel') }}</el-button>
                    <el-button type="primary" :loading="aiMockLoading" @click="onAIMookConfirm">
                        {{ t('confirm') }}
                    </el-button>
                </template>
            </el-dialog>
            <el-dialog v-model="saveTestCaseDialogVisible" :title="t('save-as-test-case')" width="360px"
                class="save-test-case-dialog" destroy-on-close append-to-body>
                <el-form :model="saveTestCaseDraft" label-position="top" class="save-test-case-dialog-form">
                    <el-form-item :label="t('test-case-name')">
                        <el-input v-model="saveTestCaseDraft.name" :placeholder="t('enter-test-case-name')"
                            clearable />
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="saveTestCaseDialogVisible = false">{{ t('cancel') }}</el-button>
                    <el-button type="primary" :loading="saveTestCaseSaving" @click="onSaveTestCaseConfirm">
                        {{ t('confirm') }}
                    </el-button>
                </template>
            </el-dialog>
            <el-drawer v-model="variableExtractionVisible" :title="t('variable-extraction')" direction="rtl"
                size="420px" destroy-on-close>
                <VariableExtraction v-if="variableExtractionVisible" :tab-id="props.tabId" />
            </el-drawer>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineComponent, watch, ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import { tabs } from '../../../panel';
import type { ToolStorage } from '../../tools';
import { getDefaultValue, normaliseJavascriptType } from '@/hook/mcp';

import KInputObject from '@/components/k-input-object/index.vue';
import { mcpClientAdapter } from '@/views/connect/core';
import { JSONSchemaFaker } from 'json-schema-faker';

import { faker } from '@faker-js/faker';
import VariableSelector from './variable-selector.vue';
import VariableExtraction from '../variable-extraction/index.vue';
import { initVariableStore, getVariables } from '../../variable-management/store';
import type { ToolVariable } from '../../variable-management/types';

// 插件注入
JSONSchemaFaker.extend('faker', () => faker);

// 可选设置
JSONSchemaFaker.option({
    useDefaultValue: true,
    alwaysFakeOptionals: true
});

defineComponent({ name: 'tool-executor' });
const mockLoading = ref(false);
const aiMockLoading = ref(false);
const aiPromptVisible = ref(false);
const enableXmlWrapper = ref(false);
const variableExtractionVisible = ref(false);
const saveTestCaseDialogVisible = ref(false);
const saveTestCaseDraft = reactive({ name: '' });
const saveTestCaseSaving = ref(false);

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ToolStorage;

if (!tabStorage.formData) {
    tabStorage.formData = {};
}

const formRef = ref<FormInstance>();
const loading = ref(false);

/** 下拉项自定义渲染：第一行标题，第二行描述（字体稍淡） */
function renderToolSelectContent(h: any, { data }: { data: { label: string; description?: string } }) {
    return h('div', { class: 'tree-select-node-content' }, [
        h('div', { class: 'tree-select-node-label' }, data.label),
        data.description
            ? h('div', { class: 'tree-select-node-desc' }, data.description)
            : null
    ]);
}

/** 深度为 2 的树：一级 MCP 服务器，二级该服务器下工具 */
const toolTreeData = computed(() => {
    return mcpClientAdapter.clients.map((client, index) => {
        const tools = client.tools;
        const children = tools ? Array.from(tools.values()).map(tool => ({
            label: tool.name,
            value: `${index}::${tool.name}`,
            description: tool.description || ''
        })) : [];
        return {
            label: client.name,
            value: `server-${index}`,
            children
        };
    });
});

const TOOL_VALUE_SEP = '::';

const selectedToolValue = computed({
    get() {
        const name = tabStorage.currentToolName;
        if (!name) return '';
        let idx = tabStorage.currentClientIndex;
        if (idx !== undefined && idx >= 0 && idx < mcpClientAdapter.clients.length) {
            const client = mcpClientAdapter.clients[idx];
            if (client.tools?.has(name)) return `${idx}${TOOL_VALUE_SEP}${name}`;
        }
        for (let i = 0; i < mcpClientAdapter.clients.length; i++) {
            if (mcpClientAdapter.clients[i].tools?.get(name)) return `${i}${TOOL_VALUE_SEP}${name}`;
        }
        return '';
    },
    set(val: string) {
        if (!val || !val.includes(TOOL_VALUE_SEP)) return;
        const sepAt = val.indexOf(TOOL_VALUE_SEP);
        const i = Number(val.slice(0, sepAt));
        const toolName = val.slice(sepAt + TOOL_VALUE_SEP.length);
        if (!Number.isNaN(i) && toolName) {
            tabStorage.currentClientIndex = i;
            tabStorage.currentToolName = toolName;
            tabStorage.lastToolCallResponse = undefined;
        }
    }
});

onMounted(() => {
    if (!tabStorage.currentToolName && toolTreeData.value.length > 0) {
        const first = toolTreeData.value[0];
        const firstChild = first?.children?.[0];
        if (firstChild && typeof firstChild.value === 'string' && firstChild.value.includes(TOOL_VALUE_SEP)) {
            const val = firstChild.value as string;
            const sepAt = val.indexOf(TOOL_VALUE_SEP);
            tabStorage.currentClientIndex = Number(val.slice(0, sepAt));
            tabStorage.currentToolName = val.slice(sepAt + TOOL_VALUE_SEP.length);
        }
    }
});

const currentTool = computed(() => {
    const idx = tabStorage.currentClientIndex;
    if (idx !== undefined && idx >= 0 && idx < mcpClientAdapter.clients.length) {
        const tool = mcpClientAdapter.clients[idx].tools?.get(tabStorage.currentToolName);
        if (tool) return tool;
    }
    for (const client of mcpClientAdapter.clients) {
        const tool = client.tools?.get(tabStorage.currentToolName);
        if (tool) return tool;
    }
});

const aiMookPrompt = ref(`please call the tool ${currentTool.value?.name || ''} to make some test`);

// 初始化变量存储（绑定到主客户端，确保变量可用）
try {
    initVariableStore(mcpClientAdapter.masterNode);
} catch (e) {
    // 已初始化或无主客户端时忽略
}

// 选择变量后，向指定输入插入占位符 ${变量名称}
function onVariableSelected(fieldName: string, variable: ToolVariable, _value: any) {
    const placeholder = `\${${variable.name}}`;
    const cur = tabStorage.formData[fieldName];
    if (typeof cur === 'string') {
        tabStorage.formData[fieldName] = cur + placeholder;
    } else if (cur === undefined || cur === null) {
        tabStorage.formData[fieldName] = placeholder;
    } else {
        // 非字符串字段，强制转字符串附加
        tabStorage.formData[fieldName] = String(cur) + placeholder;
    }
    // 清除该字段校验提示
    formRef.value?.clearValidate?.([fieldName as any]);
}

// 提供一个类型完备的包装函数，避免模板中内联箭头函数导致隐式 any 报错
function onVariableSelectedWrapper(fieldName: string) {
    return (variable: ToolVariable, value: any) => onVariableSelected(fieldName, variable, value);
}

// 解析表单中的占位符，替换为变量值
function resolveFormPlaceholders(data: any): any {
    const variables = getVariables();
    const map = new Map<string, any>();
    for (const v of variables) {
        try {
            map.set(v.name, JSON.parse(v.value));
        } catch {
            map.set(v.name, v.value);
        }
    }

    const isPlainObject = (val: any) => Object.prototype.toString.call(val) === '[object Object]';

    const replaceInString = (s: string) => {
        // 完全匹配单一占位符时，直接返回真实值（保持类型）
        const exact = s.match(/^\$\{([^}]+)\}$/);
        if (exact) {
            const name = exact[1];
            if (map.has(name)) return map.get(name);
            return s;
        }
        // 含有多个占位符时，进行字符串级替换
        return s.replace(/\$\{([^}]+)\}/g, (_m, g1) => {
            const val = map.get(g1);
            if (val === undefined) return _m; // 未找到则保留原样
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                return String(val);
            }
            try {
                return JSON.stringify(val);
            } catch {
                return String(val);
            }
        });
    };

    const deep = (val: any): any => {
        if (typeof val === 'string') return replaceInString(val);
        if (Array.isArray(val)) return val.map(deep);
        if (isPlainObject(val)) {
            const out: Record<string, any> = {};
            for (const k of Object.keys(val)) out[k] = deep(val[k]);
            return out;
        }
        return val;
    };

    return deep(data);
}

const formRules = computed<FormRules>(() => {
    const rules: FormRules = {};

    if (!currentTool.value?.inputSchema?.properties) return rules;

    Object.entries(currentTool.value.inputSchema.properties).forEach(([name, property]) => {
        if (currentTool.value?.inputSchema?.required?.includes(name)) {
            rules[name] = [
                {
                    required: true,
                    message: `${property.title || name} ` + t("is-required"),
                    trigger: 'blur'
                }
            ];
        }
    });

    return rules;
});


const initFormData = () => {
    // 初始化，根据输入的 inputSchema 校验
    // 1. 当前是否存在缺失的 key value，如果有，则根据 schema 给与默认值
    // 2. 如果有多余的 key value，则删除

    if (!currentTool.value?.inputSchema?.properties) return;

    const newSchemaDataForm: Record<string, number | boolean | string | object> = {};

    console.log(currentTool.value.inputSchema);

    Object.entries(currentTool.value.inputSchema.properties).forEach(([name, property]) => {
        newSchemaDataForm[name] = getDefaultValue(property);
        const rawType = Array.isArray(tabStorage.formData[name]) ? 'array' : typeof tabStorage.formData[name];
        const originType = normaliseJavascriptType(rawType);

        if (tabStorage.formData[name] !== undefined && originType === property.type) {
            newSchemaDataForm[name] = tabStorage.formData[name];
        }
    });

    tabStorage.formData = newSchemaDataForm;
};

/** 将表单数据全部清空为 schema 的默认空值（不保留当前输入） */
const clearFormData = () => {
    if (!currentTool.value?.inputSchema?.properties) return;
    const empty: Record<string, number | boolean | string | object> = {};
    Object.entries(currentTool.value.inputSchema.properties).forEach(([name, property]) => {
        empty[name] = getDefaultValue(property);
    });
    tabStorage.formData = empty;
};

const resetForm = () => {
    clearFormData();
    formRef.value?.clearValidate();
};

import { TaskLoop } from '@/components/main-panel/chat/core/task-loop';
import type { ChatStorage } from '../../../chat/chat-box/chat';

const onAIMookConfirm = async () => {
    aiPromptVisible.value = false;
    await generateAIMockData(aiMookPrompt.value);
};

const generateAIMockData = async (prompt?: string) => {
    if (!currentTool.value?.inputSchema) return;
    aiMockLoading.value = true;
    try {
        const loop = new TaskLoop({ maxEpochs: 1 });
        const usePrompt = prompt || `please call the tool ${currentTool.value.name} to make some test`;
        const chatStorage = {
            id: '',
            messages: [],
            settings: {
                temperature: 0.6,
                systemPrompt: '',
                enableTools: [{
                    name: currentTool.value.name,
                    description: currentTool.value.description,
                    inputSchema: currentTool.value.inputSchema,
                    enabled: true
                }],
                enableWebSearch: false,
                contextLength: 5,
                enableXmlWrapper: enableXmlWrapper.value,
                parallelToolCalls: false
            }
        } as ChatStorage;

        loop.setMaxEpochs(1);

        let aiMockJson: any = undefined;

        loop.registerOnToolCall(toolCall => {
            console.log(toolCall);

            if (toolCall.function?.name === currentTool.value?.name) {
                try {
                    const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
                    aiMockJson = toolArgs;
                } catch (e) {
                    ElMessage.error('AI 生成的 JSON 解析错误');
                }
            } else {
                ElMessage.error('AI 调用了未知的工具');
            }
            loop.abort();
            return toolCall;
        });

        loop.registerOnError(error => {
            ElMessage.error(error + '');
        });

        await loop.start(chatStorage, usePrompt);

        if (aiMockJson && typeof aiMockJson === 'object') {
            Object.keys(aiMockJson).forEach(key => {
                tabStorage.formData[key] = aiMockJson[key];
            });
            formRef.value?.clearValidate?.();
        }
    } finally {
        aiMockLoading.value = false;
    }
};

function onMockCommand(command: string) {
    if (command === 'schema') {
        generateMockData();
    } else if (command === 'ai') {
        aiPromptVisible.value = true;
    }
}

const generateMockData = async () => {
    if (!currentTool.value?.inputSchema) return;
    mockLoading.value = true;

    try {
        const mockData = await JSONSchemaFaker.generate(currentTool.value.inputSchema as any) as any;

        const schemaProperties = currentTool.value.inputSchema?.properties || {};

        Object.keys(mockData).forEach(key => {
            const schema = schemaProperties[key];

            // 非 schema 中定义的字段，跳过
            if (!schema) return;

            // 如果是 object 类型，需要清洗掉嵌套中未定义的字段
            if (schema.type === 'object') {
                const mockObj = mockData[key];
                const subSchemaProps = (schema as any).properties || {};
                const cleanObj: Record<string, any> = {};

                Object.keys(mockObj).forEach(subKey => {
                    if (subSchemaProps[subKey]) {
                        cleanObj[subKey] = mockObj[subKey];
                    }
                });

                tabStorage.formData[key] = cleanObj;
            } else {
                tabStorage.formData[key] = mockData[key];
            }
        });

        formRef.value?.clearValidate?.();
    } catch (e) {
        ElMessage.error('mock data 生成失败');
        console.error(e);
    } finally {
        mockLoading.value = false;
    }
};


async function handleExecute() {
    if (!currentTool.value) return;
    loading.value = true;
    try {
        tabStorage.lastToolCallResponse = undefined;
        const resolvedForm = resolveFormPlaceholders(tabStorage.formData);
        const toolResponse = await mcpClientAdapter.callTool(tabStorage.currentToolName, resolvedForm, tabStorage.currentClientIndex);
        tabStorage.lastToolCallResponse = toolResponse;
    } finally {
        loading.value = false;
    }
}

function onTextareaKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
    }
}

import type { TestCase, ToolStorage as ToolStorageType } from '../../tools';
import { initTestCasesStore, createTestCase } from '../test-cases/store';

/** 当前工具下保存为测试用例时的默认名称（与直接保存时生成的名字一致） */
function getDefaultTestCaseName(): string {
    return currentTool.value ? `${currentTool.value.name}_test_${new Date().toLocaleString()}` : '';
}

function saveAsTestCase() {
    if (!currentTool.value) return;
    if (!mcpClientAdapter.masterNode) {
        ElMessage.warning(t('preset-requires-connection'));
        return;
    }
    saveTestCaseDraft.name = getDefaultTestCaseName();
    saveTestCaseDialogVisible.value = true;
}

function getFriendlyCloudErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (/401|unauthorized|token|expired|鉴权|未授权/i.test(message)) {
        return '云端登录已过期，请先刷新令牌或重新登录后再试。';
    }
    return message || t('error');
}

async function onSaveTestCaseConfirm() {
    const name = saveTestCaseDraft.name?.trim();
    if (!name) {
        ElMessage.warning(t('please-enter-test-case-name'));
        return;
    }
    if (!currentTool.value) return;
    try {
        initTestCasesStore(mcpClientAdapter.masterNode);
    } catch { /* 已初始化忽略 */ }

    const now = Date.now();
    const newTestCase: TestCase = {
        id: `test_${now}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        toolName: currentTool.value.name,
        description: t('auto-generated-from-executor'),
        input: { ...tabStorage.formData },
        status: 'pending',
        createdAt: now,
        updatedAt: now
    };
    if (tabStorage.lastToolCallResponse !== undefined && tabStorage.lastToolCallResponse !== null) {
        newTestCase.expectedOutput = typeof tabStorage.lastToolCallResponse === 'string'
            ? { content: [{ type: 'text', text: tabStorage.lastToolCallResponse }], isError: false }
            : tabStorage.lastToolCallResponse;
        newTestCase.status = 'passed';
    }

    saveTestCaseSaving.value = true;
    try {
        await createTestCase(newTestCase);
        saveTestCaseDialogVisible.value = false;
        ElMessage.success(t('test-case-saved-successfully'));
    } catch (error) {
        ElMessage.error(getFriendlyCloudErrorMessage(error));
    } finally {
        saveTestCaseSaving.value = false;
    }
}

watch(currentTool, (tool) => {
    aiMookPrompt.value = `please call the tool ${tool?.name || ''} to make some test`;
});

watch(() => tabStorage.currentToolName, () => {
    initFormData();
    formRef.value?.clearValidate?.();
}, { immediate: true });

defineExpose({
    formRef,
    resetForm,
    handleExecute,
    saveAsTestCase,
    variableExtractionVisible,
    mockLoading,
    aiMockLoading,
    aiPromptVisible,
    enableXmlWrapper,
    aiMookPrompt,
    onMockCommand,
    onAIMookConfirm,
    currentTool,
    loading,
    t
});

</script>

<style>
.el-tree-select__popper .el-select-dropdown__item {
    height: fit-content !important;
}


.el-tree-node__content {
    height: fit-content !important;
}

.tool-executor-header {
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.tool-executor-header-label {
    font-size: 14px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
}

.tool-executor-header .tool-tree-select {
    flex: 1;
    min-width: 0;
    max-width: 420px;
}

/* 下拉项在 teleport 中，样式需全局生效：第一行标题，第二行描述 */
.tree-select-node-content {
    padding: 2px 0;
    min-width: 0;
}

.tree-select-node-label {
    font-weight: 500;
    margin-bottom: 4px;
}

.tree-select-node-desc {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    opacity: 0.85;
    line-height: 1.4;
    margin-top: 2px;
    max-width: 320px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 下拉在 teleport 中，用 popper-class 定位：列表项允许多行 */
.tool-tree-select-dropdown.el-select-dropdown .el-select-dropdown__item {
    height: auto;
    min-height: 32px;
    padding: 6px 12px;
    white-space: normal;
}

.tool-executor-container {
    margin-top: 15px;
    background-color: var(--background);
    border-radius: .5em;
    margin-bottom: 15px;
}

/* 仅作用于工具参数表单，避免弹窗内 el-form-item 继承 label 宽度导致输入框被挤出可视区域 */
.tool-executor-container > .el-form .el-form-item .el-form-item__label {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
}

.save-test-case-dialog-form .el-form-item {
    margin-bottom: 0;
}

.save-test-case-dialog-form .el-form-item__content {
    min-width: 0;
}

.save-test-case-dialog-form .el-input {
    width: 100%;
}

/* 参数 label 与「插入变量」按钮同一行：描述名左侧、按钮右侧 */
.param-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
    min-width: 0;
    gap: 8px;
}

.param-label-row .param-label-text {
    flex: 0 1 auto;
    min-width: 0;
}

.tool-executor-container .el-switch .el-switch__action {
    background-color: var(--main-color);
}

.tool-executor-container .el-switch.is-checked .el-switch__action {
    background-color: var(--sidebar);
}

.tool-executor-container .el-switch__core {
    border: 1px solid var(--main-color) !important;
}

.flex-center {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* AI 配置 Popover 面板 */
.ai-config-panel .panel-title {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: var(--el-text-color-primary);
}

.ai-config-panel .panel-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
}

.ai-config-panel .label-text {
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

.ai-config-panel .mb-3 {
    margin-bottom: 12px;
}

.ai-config-panel .footer-btns {
    display: flex;
    gap: 8px;
}

.tool-executor-container .el-button:active {
    transform: scale(0.95);
    transition: transform 0.08s;
}

.el-tag.el-tag--info {
    background-color: var(--main-color);
}
</style>