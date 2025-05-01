<template>
    <div class="message-role">
        <span class="message-reminder" v-if="!props.message.toolResult">
            Agent 正在使用工具
            <span class="tool-loading iconfont icon-double-loading">
            </span>
        </span>
    </div>
    <div class="message-text tool_calls" :class="[currentMessageLevel]">
        <div v-if="props.message.content" v-html="markdownToHtml(props.message.content)"></div>

        <el-collapse v-model="activeNames" v-if="props.message.tool_calls">
            <el-collapse-item name="tool">
                <template #title>
                    <div class="tool-calls">
                        <div class="tool-call-header">
                            <span class="tool-name">
                                <span class="iconfont icon-tool"></span>

                                {{ props.message.tool_calls[0].function.name }}
                            </span>
                            <el-button size="small" @click="createTest(props.message.tool_calls[0])">
                                <span class="iconfont icon-send"></span>
                            </el-button>
                        </div>
                    </div>
                </template>

                <div>
                    <div class="tool-arguments">
                        <div class="inner">
                            <div v-html="jsonResultToHtml(props.message.tool_calls[0].function.arguments)"></div>
                        </div>
                    </div>

                    <!-- 工具调用结果 -->
                    <div v-if="props.message.toolResult">
                        <div class="tool-call-header result">
                            <span class="tool-name">
                                <span :class="`iconfont icon-${currentMessageLevel}`"></span>
                                {{ isValid ? '响应': '错误' }}
                                <el-button v-if="!isValid" size="small"
                                    @click="gotoIssue()"
                                >
                                    反馈
                                </el-button>
                            </span>
                            <span style="width: 200px;" class="tools-dialog-container" v-if="currentMessageLevel === 'info'">
                                <el-switch v-model="props.message.showJson!.value" inline-prompt active-text="JSON"
                                    inactive-text="Text" style="margin-left: 10px; width: 200px;"
                                    :inactive-action-style="'backgroundColor: var(--sidebar)'" />
                            </span>
                        </div>

                        <div class="tool-result" v-if="isValid">
                            <!-- 展示 JSON -->
                            <div v-if="props.message.showJson!.value" class="tool-result-content">
                                <div class="inner">
                                    <div v-html="toHtml(props.message.toolResult)"></div>
                                </div>
                            </div>

                            <!-- 展示富文本 -->
                            <span v-else>
                                <div v-for="(item, index) in props.message.toolResult" :key="index"
                                    class="response-item"
                                >
                                    <ToolcallResultItem
                                        :item="item"
                                        @update:item="value => updateToolCallResultItem(value, index)"
                                        @update:ocr-done="value => collposePanel()"
                                    />
                                </div>
                            </span>
                        </div>
                        <div v-else class="tool-result">
                            <div class="tool-result-content"
                                v-for="(error, index) of collectErrors"
                                :key="index"
                            >
                                {{ error }}
                            </div>
                        </div>
                    </div>


                    <MessageMeta :message="message" />

                </div>
            </el-collapse-item>
        </el-collapse>
    </div>
</template>

<script setup lang="ts">
import { defineProps, ref, watch, PropType, computed, defineEmits } from 'vue';

import MessageMeta from './message-meta.vue';
import { markdownToHtml } from '../markdown/markdown';
import { createTest } from '@/views/setting/llm';
import { IRenderMessage, MessageState } from '../chat';
import { ToolCallContent } from '@/hook/type';

import ToolcallResultItem from './toolcall-result-item.vue';

const props = defineProps({
    message: {
        type: Object as PropType<IRenderMessage>,
        required: true
    },
    tabId: {
        type: Number,
        required: true
    }
});

const hasOcr = computed(() => {
    for (const item of props.message.toolResult || []) {
        const metaInfo = item._meta || {};
        const { ocr = false } = metaInfo;
        if (ocr) {
            return true;
        }
    }
    return false;
});

const activeNames = ref<string[]>(props.message.toolResult ? [''] : ['tool']);

watch(
    () => props.message.toolResult,
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

/**
 * @description 将工具调用结果转换成 html
 * @param toolResult 
 */
const toHtml = (toolResult: ToolCallContent[]) => {
    const formattedJson = JSON.stringify(toolResult, null, 2);
    const html = markdownToHtml('```json\n' + formattedJson + '\n```');
    return html;
};

const jsonResultToHtml = (jsonResult: string) => {
    try {
        const formattedJson = JSON.stringify(JSON.parse(jsonResult), null, 2);
        const html = markdownToHtml('```json\n' + formattedJson + '\n```');
        return html;   
    } catch (error) {
        const html = markdownToHtml('```json\n' + jsonResult + '\n```');
        return html; 
    }
}

function gotoIssue() {
    window.open('https://github.com/LSTM-Kirigaya/openmcp-client/issues', '_blank');
}

const isValid = computed(() => {
    try {
        const item = props.message.toolResult![0];
        if (item.type === 'error') {
            return false;
        }
        return true;
    } catch {
        return false;
    }
});

const currentMessageLevel = computed(() => {
    if (!isValid.value) {
        return 'error';
    }
    if (props.message.extraInfo.state != MessageState.Success) {
        return 'warning';
    }
    return 'info';
})

const collectErrors = computed(() => {
    const errorMessages = [];
    try {
        const errorResults = props.message.toolResult!.filter(item => item.type === 'error');
        console.log(errorResults);
        
        for (const errorResult of errorResults) {
            errorMessages.push(errorResult.text);
        }
        return errorMessages;
    } catch {
        return errorMessages;
    }
});

const emit = defineEmits(['update:tool-result']);

function updateToolCallResultItem(value: any, index: number) {
    emit('update:tool-result', value, index);
}

</script>

<style>
.message-text.tool_calls {
    border: 1px solid var(--main-color);
    border-radius: .5em;
    padding: 3px 10px;
}

.message-text.tool_calls.warning {
    border: 1px solid var(--el-color-warning);
}

.message-text.tool_calls.warning .tool-name {
    color: var(--el-color-warning);
}

.message-text.tool_calls.warning .tool-result {
	background-color: rgba(230, 162, 60, 0.5);
}

.message-text.tool_calls.error {
    border: 1px solid var(--el-color-error);
}

.message-text.tool_calls.error .tool-name {
    color: var(--el-color-error);
}

.message-text.tool_calls.error .tool-result {
	background-color: rgba(245, 108, 108, 0.5);
}


.message-text .el-collapse-item__header {
    display: flex;
    align-items: center;
    height: fit-content;
}

.message-text .el-collapse-item__content {
    padding-bottom: 5px;
}


.tool-call-item {
    margin-bottom: 10px;
}

.tool-call-header {
    display: flex;
    align-items: center;
}

.tool-call-header.result {
    margin-top: 10px;
}

.tool-name {
    font-weight: bold;
    color: var(--el-color-primary);
    margin-right: 8px;
    margin-bottom: 0;
    display: flex;
    align-items: center;
    height: 26px;
    display: flex;
    align-items: center;
}

.tool-name .iconfont {
    margin-right: 5px;
}

.tool-type {
    font-size: 0.8em;
    color: var(--el-text-color-secondary);
    background-color: var(--el-fill-color-light);
    padding: 2px 6px;
    display: flex;
    align-items: center;
    border-radius: 4px;
    margin-right: 10px;
    height: 22px;
}

.response-item {
    margin-bottom: 10px;
}

.tool-arguments {
    margin: 0;
    padding: 8px;
    background-color: var(--el-fill-color-light);
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
}

.tool-result {
    padding: 8px;
    background-color: var(--el-fill-color-light);
    border-radius: 4px;
}

.tool-text {
    white-space: pre-wrap;
    line-height: 1.6;
}

.tool-other {
    font-family: monospace;
    font-size: 0.9em;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
}
</style>