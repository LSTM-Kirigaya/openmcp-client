<template>
    <div class="batch-agent-trace message-list">
        <div v-for="(message, index) in renderMessages" :key="index"
            :class="['message-item', message.role.split('/')[0], message.role.split('/')[1] || '']">
            <div class="message-avatar" v-if="message.role === 'assistant/content'">
                <span class="iconfont icon-robot"></span>
            </div>
            <div class="message-avatar" v-else-if="message.role === 'assistant/tool_calls'"></div>
            <div class="message-avatar user-avatar" v-else-if="message.role === 'user'">
                <span class="user-avatar-mark">U</span>
            </div>
            <div v-if="message.role === 'user'" class="message-content">
                <Message.User :message="message" :tab-id="tabId" />
            </div>
            <div v-else-if="message.role === 'assistant/content'" class="message-content">
                <Message.Assistant :message="message" :tab-id="tabId" />
            </div>
            <div v-else-if="message.role === 'assistant/tool_calls'" class="message-content">
                <Message.Toolcall
                    :message="message"
                    :tab-id="tabId"
                    :collapse-by-default="collapseToolsByDefault"
                    @update:tool-result="(value, toolIndex, itemIndex) => message.toolResults[toolIndex][itemIndex] = value"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import type { ChatMessage } from '../chat/chat-box/chat';
import type { IRenderMessage, IToolRenderMessage } from '../chat/chat-box/chat';
import { MessageState } from '../chat/chat-box/chat';
import * as Message from '../chat/message';
import { getIdAsIndexAdapter } from '../chat/core/handle-tool-calls';
import { getToolCallFromXmlString, getToolResultFromXmlString, getXmlsFromString, toNormaliseToolcall } from '../chat/core/xml-wrapper';

const props = defineProps<{
    messages: ChatMessage[];
    tabId: number;
    inputRichContent?: import('../chat/chat-box/chat').RichTextItem[];
    /** 当 messages 为空时，用此作为占位用户输入展示 */
    fallbackInput?: string;
    /** 工具执行详情默认折叠 */
    collapseToolsByDefault?: boolean;
}>();

function getXmlToolCalls(message: ChatMessage) {
    if (message.role !== 'assistant' && message.role !== 'user') {
        return [];
    }
    const enableXmlTools = message.extraInfo?.enableXmlWrapper ?? false;
    if (!enableXmlTools) {
        return [];
    }
    return getXmlsFromString(message.content) || [];
}

function buildSyntheticToolCall(message: any, toolIndex: number) {
    const callId = message.tool_call_id || `batch-tool-${toolIndex}`;
    return {
        id: callId,
        type: 'function',
        index: toolIndex,
        function: {
            name: message.name || 'tool',
            arguments: '{}'
        }
    } as any;
}

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

function pushToolRenderMessages(messages: IRenderMessage[], toolCalls: any[], extraInfo: ChatMessage['extraInfo']) {
    toolCalls.forEach((toolCall, index) => {
        const toolIndex = typeof toolCall.index === 'number' ? toolCall.index : index;
        messages.push({
            role: 'assistant/tool_calls',
            content: '',
            toolResults: [[]],
            tool_calls: [toolCall],
            showJson: ref(false),
            toolIndex,
            extraInfo: {
                ...extraInfo,
                state: MessageState.Unknown
            }
        } as IToolRenderMessage);
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

watchEffect(async () => {
    if (!props.messages.length && props.fallbackInput !== undefined) {
        renderMessages.value = [{
            role: 'user',
            content: props.fallbackInput,
            ...(props.inputRichContent?.length && { richContent: props.inputRichContent }),
            extraInfo: { created: 0, state: MessageState.None, serverName: '', enableXmlWrapper: false }
        }];
        return;
    }

    const nextRenderMessages: IRenderMessage[] = [];
    let firstUserSeen = false;

    for (const message of props.messages) {
        const indexAdapter = getIdAsIndexAdapter();
        const xmls = getXmlToolCalls(message);

        if (message.role === 'user') {
            if (xmls.length > 0 && message.extraInfo.enableXmlWrapper) {
                const lastAssistantMessage = nextRenderMessages[nextRenderMessages.length - 1];
                if (lastAssistantMessage && lastAssistantMessage.role === 'assistant/tool_calls') {
                    const toolCallResultXmls = getXmlsFromString(message.content);
                    for (const xml of toolCallResultXmls) {
                        const toolResult = await getToolResultFromXmlString(xml);
                        if (toolResult) {
                            const index = indexAdapter(toolResult.callId);
                            updateToolRenderMessage(nextRenderMessages, index, toolResult.toolcallContent, message.extraInfo);
                        }
                    }
                }
            } else {
                const hasMsgRich = (message as any).richContent?.length;
                const useInputRich = !firstUserSeen && props.inputRichContent?.length;
                firstUserSeen = true;
                nextRenderMessages.push({
                    role: 'user',
                    content: message.content,
                    ...((hasMsgRich && { richContent: (message as any).richContent }) || (useInputRich && { richContent: props.inputRichContent })),
                    extraInfo: message.extraInfo
                });
            }
        } else if (message.role === 'assistant') {
            if (message.tool_calls) {
                pushAssistantContentMessage(nextRenderMessages, message.content, message.extraInfo);
                pushToolRenderMessages(nextRenderMessages, message.tool_calls, message.extraInfo);
            } else if (xmls.length > 0 && message.extraInfo.enableXmlWrapper) {
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
                pushAssistantContentMessage(nextRenderMessages, renderAssistantMessage, message.extraInfo);
                pushToolRenderMessages(nextRenderMessages, toolCalls, message.extraInfo);
            } else {
                nextRenderMessages.push({
                    role: 'assistant/content',
                    content: message.content,
                    extraInfo: message.extraInfo
                });
            }
        } else if (message.role === 'tool') {
            const safeIndex = typeof message.index === 'number' ? message.index : 0;
            let toolMessage = findToolRenderMessage(nextRenderMessages, safeIndex);
            if (!toolMessage) {
                pushToolRenderMessages(nextRenderMessages, [buildSyntheticToolCall(message, safeIndex)], {
                    ...message.extraInfo,
                    state: MessageState.Unknown
                });
                toolMessage = findToolRenderMessage(nextRenderMessages, safeIndex);
            }
            if (toolMessage) {
                updateToolRenderMessage(nextRenderMessages, safeIndex, message.content, message.extraInfo);
            }
        }
    }

    renderMessages.value = nextRenderMessages;
});
</script>

<style scoped>
.batch-agent-trace {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 2px 0;
}

.message-item {
    display: flex;
    margin-bottom: 2px;
}

.message-avatar {
    margin-right: 12px;
    margin-top: 1px;
}

.message-content {
    flex: 1;
    width: 100%;
}

.assistant {
    text-align: left;
    margin-top: 10px;
}

.assistant.tool_calls {
    margin-top: 2px;
}

.user {
    flex-direction: row-reverse;
    text-align: right;
}

.user .message-avatar {
    margin-right: 0;
    margin-left: 12px;
}

.user .message-content {
    align-items: flex-end;
}

:deep(.message-role) {
    font-weight: bold;
    margin-bottom: 4px;
    font-size: var(--chat-font-size);
    color: var(--el-text-color-regular);
}

:deep(.message-text) {
    font-size: var(--chat-font-size);
    line-height: 1.5;
}

:deep(.user .message-text) {
    margin-top: 8px;
    margin-bottom: 8px;
    width: 100%;
}

:deep(.user .message-content > span) {
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    padding: 8px 12px;
    box-sizing: border-box;
    white-space: pre-wrap;
    word-break: break-word;
    text-align: left;
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
}
</style>
