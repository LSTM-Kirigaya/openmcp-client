<template>
    <div class="message-text tool_calls" :class="[currentMessageLevel, { calling: callingTools, expanded: isExpanded }]">
        <div v-if="props.message.content" class="tool-call-message" v-html="markdownToHtml(props.message.content)"></div>

        <div
            class="tool-card-header"
            role="button"
            tabindex="0"
            @click="toggleExpanded"
            @keydown.enter.prevent="toggleExpanded"
            @keydown.space.prevent="toggleExpanded"
        >
            <span class="tool-name">
                <span class="iconfont icon-tool"></span>
                {{ toolName }}
            </span>
            <span class="tool-card-actions">
                <span class="tool-collapse-indicator" :class="{ expanded: isExpanded }"></span>
            </span>
        </div>

        <div v-if="isExpanded" class="tool-card-body">
            <div class="tool-section">
                <div class="tool-section-label">
                    <span class="iconfont icon-variable"></span>
                    <span class="tool-section-label-text">{{ t('arguments') }}</span>
                    <el-tooltip :content="t('copy')" placement="top">
                        <button type="button" class="tool-section-copy-btn" @click="copyArguments">
                            <span class="iconfont icon-copy"></span>
                        </button>
                    </el-tooltip>
                    <el-button v-if="toolCall" class="tool-debug-btn" @click.stop="createTest(toolCall)" :title="t('create-test-case')">
                        <span class="iconfont icon-send"></span>
                    </el-button>
                </div>
                <div class="tool-arguments">
                    <json-render :json="toolArguments" :show-copy="false" label="" />
                </div>
            </div>

            <div v-if="toolResult.length > 0" class="tool-section">
                <div class="tool-section-label tool-section-label--result" :class="{ 'tool-section-label--error': !isValid(toolResult) }">
                    <span v-if="isValid(toolResult)" class="iconfont icon-dui"></span>
                    <span v-else :class="`iconfont icon-${currentMessageLevel}`"></span>
                    <span class="tool-section-label-text">{{ t('response') }}</span>
                    <el-tooltip :content="t('copy')" placement="top">
                        <button type="button" class="tool-section-copy-btn" @click="copyResponse">
                            <span class="iconfont icon-copy"></span>
                        </button>
                    </el-tooltip>
                    <el-button v-if="!isValid(toolResult)" class="tool-feedback-btn" @click="gotoIssue()">
                        {{ t('feedback') }}
                    </el-button>
                    <el-switch
                        v-else-if="currentMessageLevel === 'info'"
                        v-model="showJson"
                        inline-prompt
                        active-text="JSON"
                        inactive-text="Text"
                        class="tool-view-switch"
                    />
                </div>

                <div class="tool-result" v-if="isValid(toolResult)">
                    <div v-if="showJson" class="tool-result-content">
                        <json-render :json="toolResult" :show-copy="false" label="" />
                    </div>
                    <div v-else class="tool-result-items">
                        <div v-for="(item, index) in toolResult" :key="index" class="response-item">
                            <ToolcallResultItem
                                :item="item"
                                @update:item="value => updateToolCallResultItem(value, index)"
                                @update:ocr-done="handleOcrDone"
                                @plan-approve="handlePlanApprove"
                                @plan-reject="handlePlanReject"
                                @plan-replan="handlePlanReplan"
                            />
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

            <div v-else class="tool-section tool-section--inline-loading">
                <div class="tool-section-label tool-section-label--waiting">
                    <span class="tool-loading iconfont icon-double-loading"></span>
                    {{ t('waiting-mcp-server') }}
                </div>
            </div>

            <MessageMeta :message="props.message" />
        </div>
    
    </div>
</template>

<script setup lang="ts">
import { ref, type PropType, computed } from 'vue';
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

const toolCall = computed(() => props.message.tool_calls?.[0]);
const toolResult = computed<ToolCallContent[]>(() => props.message.toolResults?.[0] || []);
const toolName = computed(() => toolCall.value?.function?.name || 'tool');
const toolArguments = computed(() => parseArguments(toolCall.value?.function?.arguments));
const showJson = ref(true);
const isExpanded = ref(false);

const callingTools = computed(() => toolResult.value.length === 0);

function toggleExpanded() {
    isExpanded.value = !isExpanded.value;
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
    if (toolResult.value.length === 0) {
        return 'info';
    }

    if (!isValid(toolResult.value)) {
        return 'error';
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

function updateToolCallResultItem(value: any, index: number) {
    emits('update:tool-result', value, 0, index);
}

function handleOcrDone() {
    return;
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

async function copyArguments() {
    const args = toolCall.value?.function?.arguments;
    const parsed = parseArguments(args);
    const text = typeof args === 'string' ? args : JSON.stringify(parsed, null, 2);
    try {
        await navigator.clipboard.writeText(text);
        ElMessage.success(t('copied'));
    } catch {
        ElMessage.error(t('copy-failed'));
    }
}

async function copyResponse() {
    const result = toolResult.value;
    let text: string;
    if (!isValid(result)) {
        text = collectErrors(result).join('\n');
    } else {
        text = JSON.stringify(result, null, 2);
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
.message-text.tool_calls {
    --tool-border-color: var(--sidebar-item-border, var(--el-border-color, rgba(127, 127, 127, 0.35)));
    --tool-panel-bg: var(--el-input-bg-color, var(--el-fill-color-blank));
    --tool-muted-bg: var(--sidebar-item-hover, rgba(127, 127, 127, 0.06));
    width: 90%;
    border: 1px solid var(--tool-border-color);
    border-radius: 8px;
    padding: 10px;
    background-color: var(--tool-panel-bg);
    transition: var(--animation-3s);
}

.message-text.tool_calls.warning {
    border-color: rgba(230, 162, 60, 0.45);
    box-shadow: inset 3px 0 0 var(--el-color-warning);
}

.message-text.tool_calls.error {
    border-color: rgba(245, 108, 108, 0.45);
    box-shadow: inset 3px 0 0 var(--el-color-error);
}

.message-text.tool_calls.calling {
    border-style: dashed;
    background: var(--sidebar-item-selected, var(--tool-panel-bg));
}

.tool-call-message {
    margin-bottom: 8px;
    line-height: 1.5;
}

.tool-call-message > :first-child {
    margin-top: 0;
}

.tool-call-message > :last-child {
    margin-bottom: 0;
}

.tool-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
    border: none;
    color: var(--foreground);
    cursor: pointer;
    outline: none;
    user-select: none;
}

.tool-card-header:focus-visible {
    border-radius: 6px;
    box-shadow: 0 0 0 2px var(--main-light-color-30, rgba(99, 102, 241, 0.3));
}

.message-text.tool_calls.expanded .tool-card-header {
    padding-bottom: 8px;
    border-bottom: 1px solid var(--tool-border-color);
}

.message-text.tool_calls.calling.expanded .tool-card-header {
    border-bottom-style: dashed;
}

.tool-card-body {
    margin-top: 8px;
}

.tool-card-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.tool-collapse-indicator {
    width: 7px;
    height: 7px;
    border-right: 1.5px solid var(--el-text-color-secondary);
    border-bottom: 1.5px solid var(--el-text-color-secondary);
    transform: rotate(-45deg);
    transition: var(--animation-3s);
}

.tool-collapse-indicator.expanded {
    transform: rotate(45deg);
}

.tool-call-badge {
    flex-shrink: 0;
    padding: 1px 5px;
    border-radius: 6px;
    border: 1px solid var(--main-light-color-30, var(--tool-border-color));
    background: var(--main-light-color-20, rgba(99, 102, 241, 0.2));
    color: var(--main-color, var(--foreground));
    font-size: var(--chat-font-size-xs);
    font-weight: 700;
}

.tool-name {
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--foreground);
    font-size: var(--chat-font-size-sm);
    font-weight: 700;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.message-text.tool_calls.warning .tool-name {
    color: var(--el-color-warning);
}

.message-text.tool_calls.error .tool-name {
    color: var(--el-color-error);
}

.tool-name .iconfont {
    flex-shrink: 0;
    font-size: 12px;
    opacity: 0.9;
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

.tool-debug-btn {
    flex-shrink: 0;
}

.tool-section-label .tool-debug-btn {
    margin-left: 2px;
}

.tool-debug-btn .iconfont,
.message-text.tool_calls .tool-debug-btn .iconfont {
    font-size: 11px;
}

.tool-debug-btn:hover,
.message-text.tool_calls .el-button:hover {
    opacity: 0.9;
}

.tool-feedback-btn {
    margin-left: auto;
}

.tool-section {
    margin-top: 8px;
}

.tool-section:first-of-type {
    margin-top: 0;
}

.tool-section-label {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 24px;
    margin-bottom: 4px;
    color: var(--el-text-color-secondary);
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: var(--chat-font-size-sm);
    font-weight: 700;
}

.tool-section-label .iconfont {
    font-size: var(--chat-font-size-sm);
    opacity: 0.9;
}

.tool-section-label-text {
    line-height: 1.3;
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

.tool-section-copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-left: 2px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    line-height: 1;
    transition: var(--animation-3s);
}

.tool-section-copy-btn:hover {
    color: var(--foreground);
    border-color: var(--tool-border-color);
    background: var(--tool-muted-bg);
}

.tool-section-copy-btn .iconfont {
    font-size: 12px;
}

.tool-view-switch {
    margin-left: auto;
}

.tool-view-switch .el-switch__label {
    font-size: var(--chat-font-size-xs);
}

.tool-arguments,
.tool-result {
    margin: 0;
    border: 1px solid var(--tool-border-color);
    border-radius: 6px;
    background: var(--background, var(--tool-panel-bg));
    overflow: hidden;
}

.message-text.tool_calls.warning .tool-arguments,
.message-text.tool_calls.warning .tool-result {
    border-color: rgba(230, 162, 60, 0.35);
}

.message-text.tool_calls.error .tool-arguments,
.message-text.tool_calls.error .tool-result {
    border-color: rgba(245, 108, 108, 0.35);
}

.tool-arguments .json-render,
.tool-result .json-render {
    font-size: var(--chat-font-size);
}

.tool-arguments .json-render-body,
.tool-result .json-render-body {
    padding: 8px 10px;
}

.tool-arguments .openmcp-code-block,
.tool-result .openmcp-code-block {
    margin: 0;
    border: none;
    border-radius: 0;
    background: transparent;
}

.tool-result-content,
.tool-result-items {
    background: transparent;
}

.tool-result-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
}

.response-item {
    min-width: 0;
}

.response-item + .response-item {
    padding-top: 6px;
    border-top: 1px solid var(--tool-border-color);
}

.tool-result .token.string {
    cursor: pointer;
    border-radius: 3px;
    padding: 1px 2px;
    margin: -1px -2px;
}

.tool-result .token.string:hover {
    background: var(--el-fill-color-light);
    outline: 1px solid var(--el-border-color-lighter);
}

.tool-result--error {
    background: rgba(245, 108, 108, 0.06);
}

.tool-error-scrollbar {
    --el-scrollbar-opacity: 0.3;
}

.tool-error-item + .tool-error-item {
    border-top: 1px solid rgba(245, 108, 108, 0.2);
}

.tool-error-content {
    display: inline-block;
    min-width: 100%;
    margin: 0;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: var(--el-color-error);
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: var(--chat-font-size);
    line-height: 1.5;
    white-space: pre;
}

.tool-section--inline-loading {
    padding: 8px 10px;
    border: 1px dashed var(--tool-border-color);
    border-radius: 6px;
    background: var(--tool-muted-bg);
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
