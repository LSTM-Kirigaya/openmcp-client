<template>
    <div class="message-text tool_calls" :class="[currentMessageLevel]">
        
        <!-- 工具的消息 -->
        <div v-if="props.message.content" class="tool-call-message" v-html="markdownToHtml(props.message.content)"></div>

        <!-- 工具的调用 -->
        <el-collapse v-model="activeNames" v-if="props.message.tool_calls" class="tool-calls-collapse">
            <el-collapse-item name="tool">
                <template #title>
                    <div class="tool-calls">
                        <div class="tool-call-header tool-call-header--main">
                            <span class="tool-call-badge" v-if="(props.message.tool_calls?.length ?? 0) > 1">#1</span>
                            <span class="tool-name">
                                <span class="iconfont icon-tool"></span>
                                {{ props.message.tool_calls[0].function!.name }}
                            </span>
                            <el-button class="tool-debug-btn" @click="createTest(props.message.tool_calls[0])" :title="t('create-test-case')">
                                <span class="iconfont icon-send"></span>
                            </el-button>
                        </div>
                    </div>
                </template>

                <div v-for="(toolResult, toolIndex) in props.message.toolResults" :key="toolIndex"
                    class="toolcall-item">

                    <div class="tool-calls" v-if="toolIndex > 0">
                        <div class="tool-call-header tool-call-header--main">
                            <span class="tool-call-badge" v-if="(props.message.tool_calls?.length ?? 0) > 1">#{{ toolIndex + 1 }}</span>
                            <span class="tool-name">
                                <span class="iconfont icon-tool"></span>
                                {{ props.message.tool_calls[toolIndex].function!.name }}
                            </span>
                            <el-button class="tool-debug-btn" @click="createTest(props.message.tool_calls[toolIndex])" :title="t('create-test-case')">
                                <span class="iconfont icon-send"></span>
                            </el-button>
                        </div>
                    </div>

                    <!-- 参数区块：参数 + 复制图标同一行，布局紧凑 -->
                    <div class="tool-section">
                        <div class="tool-section-label">
                            <span class="iconfont icon-variable"></span>
                            <span class="tool-section-label-text">{{ t('arguments') }}</span>
                            <el-tooltip :content="t('copy')" placement="top">
                                <button type="button" class="tool-section-copy-btn" @click="copyArguments(toolIndex)">
                                    <span class="iconfont icon-copy"></span>
                                </button>
                            </el-tooltip>
                        </div>
                        <div class="tool-arguments">
                            <json-render
                                :json="parseArguments(props.message.tool_calls[toolIndex].function!.arguments)"
                                :show-copy="false"
                                label=""
                            />
                        </div>
                    </div>

                    <!-- 工具调用结果：响应 + 复制图标同一行 -->
                    <div v-if="toolResult.length > 0" class="tool-section">
                        <div class="tool-section-label tool-section-label--result" :class="{ 'tool-section-label--error': !isValid(toolResult) }">
                            <span v-if="isValid(toolResult)" class="iconfont icon-dui"></span>
                            <span v-else :class="`iconfont icon-${currentMessageLevel}`"></span>
                            <span class="tool-section-label-text">{{ t('response') }}</span>
                            <el-tooltip :content="t('copy')" placement="top">
                                <button type="button" class="tool-section-copy-btn" @click="copyResponse(toolIndex)">
                                    <span class="iconfont icon-copy"></span>
                                </button>
                            </el-tooltip>
                            <el-button v-if="!isValid(toolResult)" class="tool-feedback-btn" @click="gotoIssue()">
                                {{ t('feedback') }}
                            </el-button>
                            <el-switch
                                v-else-if="currentMessageLevel === 'info'"
                                v-model="showJsons[toolIndex]"
                                inline-prompt
                                active-text="JSON"
                                inactive-text="Text"
                                class="tool-view-switch"
                            />
                        </div>

                        <div class="tool-result" v-if="isValid(toolResult)">
                            <div v-if="showJsons[toolIndex]" class="tool-result-content">
                                <json-render
                                    :json="props.message.toolResults[toolIndex]"
                                    :show-copy="false"
                                    label=""
                                />
                            </div>
                            <div v-else class="tool-result-items">
                                <div v-for="(item, index) in props.message.toolResults[toolIndex]" :key="index" class="response-item">
                                    <ToolcallResultItem :item="item"
                                        @update:item="value => updateToolCallResultItem(value, toolIndex, index)"
                                        @update:ocr-done="value => collposePanel()"
                                        @plan-approve="handlePlanApprove"
                                        @plan-reject="handlePlanReject"
                                        @plan-replan="handlePlanReplan" />
                                </div>
                            </div>
                        </div>
                        <div v-else class="tool-result tool-result--error">
                            <el-scrollbar class="tool-error-scrollbar" max-height="200px">
                                <div class="tool-error-item" v-for="(error, index) of collectErrors(toolResult)" :key="index">
                                    <pre class="tool-error-content">{{ error }}</pre>
                                </div>
                            </el-scrollbar>
                        </div>
                    </div>

                    <!-- 等待 MCP 响应 -->
                    <div v-else class="tool-section tool-section--inline-loading">
                        <div class="tool-section-label tool-section-label--waiting">
                            <span class="tool-loading iconfont icon-double-loading"></span>
                            {{ t('waiting-mcp-server') }}
                        </div>
                    </div>

                    <MessageMeta v-if="toolIndex === props.message.toolResults.length - 1" :message="props.message" />

                </div>
            </el-collapse-item>
        </el-collapse>
    
    </div>
</template>

<script setup lang="ts">
import { ref, watch, type PropType, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import MessageMeta from './message-meta.vue';
import { markdownToHtml } from '@/components/main-panel/chat/markdown/markdown';
import { createTest } from '@/views/setting/llm';
import { type IToolRenderMessage, MessageState } from '../chat-box/chat';
import type { ToolCallContent } from '@/hook/type';

import { ElMessage } from 'element-plus';
import ToolcallResultItem from './toolcall-result-item.vue';
import JsonRender from '@/components/json-render/index.vue';


const { t } = useI18n();
const props = defineProps({
    message: {
        type: Object as PropType<IToolRenderMessage>,
        required: true
    },
    tabId: {
        type: Number,
        required: true
    },
    collapseByDefault: {
        type: Boolean,
        default: false
    }
});

const hasOcr = computed(() => {
    if (props.message.role === 'assistant/tool_calls') {
        for (const toolResult of props.message.toolResults) {
            for (const item of toolResult) {
                const metaInfo = item._meta || {};
                const { ocr = false } = metaInfo;
                if (ocr) {
                    return true;
                }
            }
        }
    }

    return false;
});


const callingTools = computed(() => {
    const emptyToolResult = props.message.toolResults.find(item => item.length === 0);    

    if (emptyToolResult) {
        return true;
    }

    return false;
});

const showJsons = ref<boolean[]>([]);
props.message.toolResults.forEach(() => {
    showJsons.value.push(true);
});

const activeNames = ref<string[]>(!props.collapseByDefault && callingTools.value ? ['tool'] : []);

watch(
    () => props.message,
    (value, _) => {
        if (hasOcr.value) {
            return;
        }

        if (value) {
            collposePanel();
        }
    }
);

function collposePanel() {
    setTimeout(() => {
        activeNames.value = [''];
    }, 1000);
}


function gotoIssue() {
    window.open('https://github.com/LSTM-Kirigaya/openmcp-client/issues', '_blank');
}


function isValid(toolResult: ToolCallContent[]) {
    try {
        const item = toolResult[0];
        if (item.type === 'error') {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}


const currentMessageLevel = computed(() => {

    // 此时正在等待 mcp server 给出回应
    for (const toolResult of props.message.toolResults) {
        if (toolResult.length === 0) {
            return 'info';
        }

        if (!isValid(toolResult)) {
            return 'error';
        }
    }

    if (props.message.extraInfo.state !== MessageState.Success) {
        return 'warning';
    }

    return 'info';
});


function collectErrors(toolResult: ToolCallContent[]) {
    const errorMessages = [];
    try {
        const errorResults = toolResult.filter(item => item.type === 'error');

        for (const errorResult of errorResults) {
            errorMessages.push(errorResult.text);
        }
        return errorMessages;
    } catch {
        return errorMessages;
    }
}

const emits = defineEmits(['update:tool-result', 'plan-approve', 'plan-reject', 'plan-replan']);

function updateToolCallResultItem(value: any, toolIndex: number, index: number) {
    emits('update:tool-result', value, toolIndex, index);
}

function handlePlanApprove(meta: any) {
    emits('plan-approve', meta);
}

function handlePlanReject(feedback: string, meta: any) {
    emits('plan-reject', feedback, meta);
}

function handlePlanReplan(meta: any) {
    emits('plan-replan', meta);
}

function parseArguments(args: string | undefined): object {
    try {
        return JSON.parse(args || '{}');
    } catch {
        return { rawArgs: args || '' };
    }
}

async function copyArguments(toolIndex: number) {
    const args = props.message.tool_calls?.[toolIndex]?.function?.arguments;
    const parsed = parseArguments(args);
    const text = typeof args === 'string' ? args : JSON.stringify(parsed, null, 2);
    try {
        await navigator.clipboard.writeText(text);
        ElMessage.success(t('copied'));
    } catch {
        ElMessage.error(t('copy-failed'));
    }
}

async function copyResponse(toolIndex: number) {
    const toolResult = props.message.toolResults[toolIndex];
    let text: string;
    if (!isValid(toolResult)) {
        text = collectErrors(toolResult).join('\n');
    } else {
        text = JSON.stringify(toolResult, null, 2);
    }
    try {
        await navigator.clipboard.writeText(text);
        ElMessage.success(t('copied'));
    } catch {
        ElMessage.error(t('copy-failed'));
    }
}

</script>

<style>
/* message-text tool_calls 基础样式 - 与用户消息、测试用例卡片等保持一致 */
.message-text.tool_calls {
    border: 1px solid var(--sidebar-item-border);
    border-radius: 8px;
    padding: 8px 10px;
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    transition: var(--animation-3s);
}

.tool-call-message {
    margin-bottom: 8px;
    line-height: 1.5;
}

/* info 成功/就绪状态 - 使用中性灰背景，降低刺眼感，利于调试 */
.message-text.tool_calls.info {
    border-color: var(--sidebar-item-border);
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    box-shadow: none;
}

.message-text.tool_calls.info .tool-name {
    color: var(--foreground);
}

/* 展开区域：仅最外层容器设背景，内层透明继承 */
.message-text.tool_calls.info .el-collapse-item__content {
    background-color: transparent;
}

.message-text.tool_calls.info .tool-arguments,
.message-text.tool_calls.info .tool-result {
    border: 1px solid var(--sidebar-item-border);
}

/* tool-result 内部不重复设背景，透明继承父级 */
.message-text.tool_calls.info .tool-result-content,
.message-text.tool_calls.info .response-item,
.message-text.tool_calls.info .tool-result-items {
    background-color: transparent !important;
    border: none;
}

.message-text.tool_calls.info .tool-arguments .openmcp-code-block,
.message-text.tool_calls.info .tool-result-content .openmcp-code-block,
.message-text.tool_calls.info .json-render--with-copy {
    background-color: transparent;
    border-color: var(--sidebar-item-border);
}

.message-text.tool_calls.info .tool-arguments :deep(pre) code,
.message-text.tool_calls.info .tool-result-content :deep(pre) code {
    background-color: transparent !important;
}

.message-text.tool_calls .json-render,
.message-text.tool_calls .json-render :deep(.json-render-body) {
    font-size: var(--chat-font-size);
}

.tool-result-content--waiting,
.tool-result-content .progress {
    border-radius: 6px;
    background-color: transparent !important;
    padding: 12px 8px;
    width: 50%;
    border: 1px solid var(--sidebar-item-border);
}

.message-text.tool_calls.info :deep(.el-scrollbar__view) {
    background-color: transparent !important;
}

.message-text.tool_calls.warning {
    border-color: var(--el-color-warning);
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
}

.message-text.tool_calls.warning .tool-name {
    color: var(--el-color-warning);
}

.message-text.tool_calls.warning .tool-arguments,
.message-text.tool_calls.warning .tool-result {
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    border: 1px solid rgba(230, 162, 60, 0.3);
}

.message-text.tool_calls.error {
    border-color: var(--el-color-error);
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
}

.message-text.tool_calls.error .tool-name {
    color: var(--el-color-error);
}

.message-text.tool_calls.error .tool-arguments,
.message-text.tool_calls.error .tool-result {
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    border: 1px solid rgba(245, 108, 108, 0.3);
}

.message-text .el-collapse-item__header {
    display: flex;
    align-items: center;
    height: fit-content;
    min-height: unset;
    padding: 2px 0;
    border: none;
    background: transparent !important;
}

.message-text .el-collapse-item__content {
    padding: 8px 0 10px;
}

/* 工具调用主标题 - 开发者可读性优化 */
.tool-call-header--main {
    gap: 4px;
}

.tool-call-badge {
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: 9px;
    font-weight: 700;
    padding: 1px 3px;
    border-radius: 3px;
    background: var(--el-input-bg-color, var(--el-fill-color-blank));
    color: var(--el-text-color-secondary);
    border: 1px solid var(--sidebar-item-border);
    letter-spacing: 0.02em;
}

.tool-debug-btn,
.message-text.tool_calls .el-button {
    border-radius: 6px !important;
    padding: 2px 6px !important;
    min-height: 22px !important;
    height: 22px !important;
    font-size: 11px !important;
    background-color: var(--foreground) !important;
    color: var(--background) !important;
    border-color: var(--foreground) !important;
    transition: var(--animation-3s);
}

.tool-debug-btn .iconfont,
.message-text.tool_calls .tool-debug-btn .iconfont {
    font-size: 11px;
}

.tool-debug-btn:hover,
.message-text.tool_calls .el-button:hover {
    background-color: var(--foreground) !important;
    color: var(--background) !important;
    border-color: var(--foreground) !important;
    opacity: 0.9;
}

.tool-feedback-btn {
    margin-left: auto;
    padding: 2px 6px !important;
    min-height: 22px !important;
    font-size: 11px !important;
}

/* 区块标签 - Arguments / Response 等 */
.tool-section {
    margin-top: 10px;
}

.tool-section:first-of-type {
    margin-top: 0;
}

.tool-section-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--chat-font-size-sm);
    font-weight: 600;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    letter-spacing: 0.02em;
}

.tool-section-label .iconfont {
    font-size: var(--chat-font-size-sm);
    opacity: 0.9;
}

.tool-section-copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    padding: 2px 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
}
.tool-section-copy-btn:hover {
    color: var(--foreground);
    background: var(--sidebar-item-hover);
}
.tool-section-copy-btn .iconfont {
    font-size: 12px;
}

.tool-section-label--result {
    color: var(--signal-default-color, #4CAF50);
}

.tool-section-label--error {
    color: var(--el-color-error);
}

.tool-section-label--waiting {
    color: var(--el-text-color-secondary);
}

.tool-view-switch {
    margin-left: auto;
}

.tool-view-switch :deep(.el-switch__label) {
    font-size: var(--chat-font-size-xs);
}

.toolcall-item .tool-calls {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--sidebar-item-border);
}

.tool-call-item {
    margin-bottom: 6px;
}

.tool-call-header {
    display: flex;
    align-items: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    gap: 4px;
    min-height: 22px;
}

.tool-name {
    font-weight: 600;
    color: var(--foreground);
    margin-right: 6px;
    margin-bottom: 0;
    display: flex;
    align-items: center;
    height: 18px;
    font-size: var(--chat-font-size-sm);
}

.tool-name .iconfont {
    margin-right: 3px;
    font-size: 12px;
    opacity: 0.9;
}

.tool-type {
    font-size: var(--chat-font-size-xs);
    color: var(--el-text-color-secondary);
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    padding: 2px 6px;
    display: flex;
    align-items: center;
    border-radius: 4px;
    margin-right: 6px;
    height: 20px;
    border: 1px solid var(--main-light-color-20);
}

.response-item {
    margin-bottom: 6px;
}

.tool-result-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

/* Arguments 与 Result 区块 - 中性灰背景，利于调试 */
.tool-arguments {
    margin: 0;
    padding: 0;
    border-radius: 6px;
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: var(--chat-font-size);
    line-height: 1.5;
    overflow: hidden;
}

.tool-arguments :deep(.json-render-body) {
    padding: 8px 10px;
}

.tool-result {
    padding: 0;
    border-radius: 6px;
    border: 1px solid var(--sidebar-item-border);
    overflow: hidden;
}

.tool-result :deep(.json-render-body) {
    padding: 8px 10px;
}

/* 响应部分 JSON 中 token string 可点击展开弹窗（与参数区一致，对所有 .token.string 生效） */
.tool-result-content :deep(.token.string) {
    cursor: pointer;
    border-radius: 3px;
    padding: 1px 2px;
    margin: -1px -2px;
}
.tool-result-content :deep(.token.string:hover) {
    background: var(--el-fill-color-light);
    outline: 1px solid var(--el-border-color-lighter);
}

/* 错误展示 - 开发者可读 */
.tool-result--error {
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    border-color: rgba(245, 108, 108, 0.3);
}

.tool-error-scrollbar {
    --el-scrollbar-opacity: 0.3;
}

.tool-error-item {
    margin-bottom: 4px;
}

.tool-error-item:last-child {
    margin-bottom: 0;
}

.tool-error-content {
    margin: 0;
    padding: 8px 10px;
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: var(--chat-font-size);
    line-height: 1.5;
    white-space: pre;
    display: inline-block;
    min-width: 100%;
    color: var(--el-color-error);
    background: transparent;
    border: none;
}

.tool-text {
    white-space: pre-wrap;
    line-height: 1.5;
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: var(--chat-font-size);
}

.tool-other {
    font-family: var(--font-monospace-family, monospace);
    font-size: var(--chat-font-size-sm);
    color: var(--el-text-color-secondary);
    margin-top: 2px;
}
</style>