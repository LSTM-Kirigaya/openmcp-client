<template>
    <div class="tool-trace-container">
        <div class="tool-trace-header">
            <el-segmented v-model="traceMode" :options="traceModeItems" size="default"
                style="background-color: var(--background);">
                <template #default="scope">
                    {{ scope.item.label }}
                </template>
            </el-segmented>
        </div>

        <div class="tool-trace-content">
            <TraceTable
                v-if="traceMode === 'table'"
                :render-messages="renderMessages"
            />
            <TraceDiagram
                v-else-if="traceMode === 'diagram'"
                :render-messages="renderMessages"
            />
            <TraceFsm
                v-else-if="traceMode === 'fsm'"
                :render-messages="renderMessages"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineProps, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { tabs } from '../../panel';
import type { ChatMessage, ChatStorage, IRenderMessage, ToolCall } from '../chat-box/chat';

import TraceTable from './trace-table.vue';
import TraceDiagram from './trace-diagram.vue';
import TraceFsm from './trace-fsm.vue';

import { getToolCallFromXmlString, getToolResultFromXmlString, getXmlsFromString, toNormaliseToolcall } from '../core/xml-wrapper';
import { getIdAsIndexAdapter } from '../core/handle-tool-calls';
import { MessageState } from '../chat-box/chat';

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage;

// 追踪模式：table 或 diagram
const traceMode = ref<'table' | 'diagram'>('table');

const traceModeItems = ref([
    {
        label: t('trace-table-mode'),
        value: 'table'
    },
    {
        label: t('trace-diagram-mode'),
        value: 'diagram'
    },
    {
        label: t('trace-fsm-mode'),
        value: 'fsm'
    }
]);

// 渲染消息
const renderMessages = ref<IRenderMessage[]>([]);

function pushAssistantContentMessage(messages: IRenderMessage[], content: string, extraInfo: ChatMessage['extraInfo']) {
    if (!content?.trim()) {
        return;
    }

    messages.push({
        role: 'assistant/content',
        content,
        extraInfo
    });
}

function pushToolRenderMessages(messages: IRenderMessage[], toolCalls: ToolCall[], extraInfo: ChatMessage['extraInfo']) {
    toolCalls.forEach((toolCall, index) => {
        const toolIndex = typeof toolCall.index === 'number' ? toolCall.index : index;
        messages.push({
            role: 'assistant/tool_calls',
            content: '',
            toolResults: [[]],
            tool_calls: [toolCall],
            toolIndex,
            showJson: ref(false),
            extraInfo: {
                ...extraInfo,
                state: MessageState.Unknown
            }
        });
    });
}

function findToolRenderMessage(messages: IRenderMessage[], toolIndex: number) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.role !== 'assistant/tool_calls') {
            continue;
        }
        const currentToolIndex = message.toolIndex ?? message.tool_calls[0]?.index ?? 0;
        if (currentToolIndex === toolIndex) {
            return message;
        }
    }
    return undefined;
}

function updateToolRenderMessage(
    messages: IRenderMessage[],
    toolIndex: number,
    content: any,
    extraInfo: ChatMessage['extraInfo']
) {
    const toolMessage = findToolRenderMessage(messages, toolIndex);
    if (!toolMessage) {
        return;
    }

    toolMessage.toolResults[0] = content;
    if (toolMessage.extraInfo.state === MessageState.Unknown) {
        toolMessage.extraInfo.state = extraInfo.state;
    } else if (toolMessage.extraInfo.state === MessageState.Success || extraInfo.state !== MessageState.Success) {
        toolMessage.extraInfo.state = extraInfo.state;
    }
    toolMessage.extraInfo.usage = toolMessage.extraInfo.usage || extraInfo.usage;
}

// 监听消息变化并更新渲染消息
watch(() => tabStorage.messages, async () => {
    renderMessages.value = [];
    for (const message of tabStorage.messages) {
        const indexAdapter = getIdAsIndexAdapter();
        const xmls = getXmlToolCalls(message);

        if (message.role === 'user') {
            if (xmls.length > 0 && message.extraInfo.enableXmlWrapper) {
                // 判断是否是 xml 模式，如果是 xml 模式且存在有效的 xml，则按照工具来判定
                // 往前寻找 assistant/tool_calls 并自动加入其中
                const lastAssistantMessage = renderMessages.value[renderMessages.value.length - 1];
                if (lastAssistantMessage && lastAssistantMessage.role === 'assistant/tool_calls') {

                    const toolCallResultXmls = getXmlsFromString(message.content);

                    for (const xml of toolCallResultXmls) {
                        const toolResult = await getToolResultFromXmlString(xml);
                        if (toolResult) {
                            const index = indexAdapter(toolResult.callId);
                            updateToolRenderMessage(renderMessages.value, index, toolResult.toolcallContent, message.extraInfo);
                        }
                    }
                }

            } else {
                renderMessages.value.push({
                    role: 'user',
                    content: message.content,
                    ...(message.richContent && message.richContent.length > 0 && { richContent: message.richContent }),
                    extraInfo: message.extraInfo
                });
            }

        } else if (message.role === 'assistant') {
            if (message.tool_calls) {
                pushAssistantContentMessage(renderMessages.value, message.content, message.extraInfo);
                pushToolRenderMessages(renderMessages.value, message.tool_calls, message.extraInfo);
            } else {
                if (xmls.length > 0 && message.extraInfo.enableXmlWrapper) {
                    // 判断是否是 xml 模式，如果是 xml 模式且存在有效的 xml，则按照工具来判定
                    const toolCalls = [];
                    for (const xml of xmls) {
                        const xmlToolCall = await getToolCallFromXmlString(xml);
                        if (xmlToolCall) {
                            toolCalls.push(
                                toNormaliseToolcall(xmlToolCall, indexAdapter)
                            );
                        }
                    }
                    const renderAssistantMessage = message.content.replace(/```xml[\s\S]*?```/g, '');

                    pushAssistantContentMessage(renderMessages.value, renderAssistantMessage, message.extraInfo);
                    pushToolRenderMessages(renderMessages.value, toolCalls, message.extraInfo);
                } else {
                    renderMessages.value.push({
                        role: 'assistant/content',
                        content: message.content,
                        extraInfo: message.extraInfo
                    });
                }

            }

        } else if (message.role === 'tool') {
            // 如果是工具，则合并进入 之前 assistant 一起渲染
            updateToolRenderMessage(renderMessages.value, message.index, message.content, message.extraInfo);
        }
    }
}, { immediate: true, deep: true });

function getXmlToolCalls(message: any) {
    if (message.role !== 'assistant' && message.role !== 'user') {
        return [];
    }

    const enableXmlTools = message.extraInfo?.enableXmlWrapper ?? false;

    if (!enableXmlTools) {
        return [];
    }

    const xmls = getXmlsFromString(message.content);

    return xmls || [];
}
</script>

<style scoped>
.tool-trace-container {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.tool-trace-header {
    padding: 10px;
    border-bottom: 1px solid var(--el-border-color);
    background-color: var(--sidebar);
}

.mode-selector {
    width: 200px;
}

.tool-trace-content {
    flex: 1;
    overflow: hidden;
}

.diagram-placeholder {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
