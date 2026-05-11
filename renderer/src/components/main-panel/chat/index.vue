<template>
    <div class="chat-container" :ref="el => chatContainerRef = el">
        <!-- 聊天模式切换工具栏 -->
        <ChatToolbar 
            v-if="chatMode !== 'test'"
            :chat-mode="chatMode"
            :selected-models="selectedModels"
            :filtered-models="filteredModels"
            :parallel-chats="parallelChats"
            @update:chat-mode="value => chatMode = value"
            @update:selected-models="value => selectedModels = value"
            @init-parallel-chats="initParallelChats"
            @filter-models="filterModels"
            @clear-single-chat="clearSingleChat"
        />

        <!-- 单聊天模式 -->
        <SingleChat 
            v-if="chatMode === 'single-chat'"
            :tab-id="props.tabId"
            :render-messages="renderMessages"
            :streaming-content="streamingContent"
            :is-loading="isLoading"
            ref="singleChatRef"
            @plan-approve="handlePlanApprove"
            @plan-reject="handlePlanReject"
            @plan-replan="handlePlanReplan"
        />

        <!-- 并行聊天模式 -->
        <ParallelChat 
            v-else-if="chatMode === 'parallel-chat'"
            :tab-id="props.tabId"
            :selected-models="selectedModels"
            :parallel-chats="parallelChats"
            :streaming-content="streamingContent"
            :streaming-tool-calls="streamingToolCalls"
            :is-loading="isLoading"
        />

        <!-- 工具调用追踪模式 -->
        <ToolTrace
            v-else-if="chatMode === 'tool-trace'"
            :tab-id="props.tabId"
        />

        <ChatBox 
            v-if="chatMode !== 'tool-trace'"
            :ref="el => footerRef = el" 
            :tab-id="props.tabId" 
        />
    </div>
</template>

<script setup lang="ts">
import { ref, defineComponent, defineProps, computed, nextTick, watch, provide, watchEffect, onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { type ScrollbarInstance } from 'element-plus';
import { tabs } from '../panel';
import type { ChatMessage, ChatStorage, IRenderMessage, ToolCall, ParallelChatInstance } from './chat-box/chat';
import { MessageState } from './chat-box/chat';

import * as Message from './message';
import ChatBox from './chat-box/index.vue';
import SingleChat from './single-chat.vue';
import ParallelChat from './parallel-chat.vue';
import ToolTrace from './tool-trace/index.vue';
import ChatToolbar from './chat-toolbar.vue';
import { getToolCallFromXmlString, getToolResultFromXmlString, getXmlsFromString, toNormaliseToolcall } from './core/xml-wrapper';
import { getIdAsIndexAdapter } from './core/handle-tool-calls';
import { llms } from '@/views/setting/llm';
import { v4 as uuidv4 } from 'uuid';

defineComponent({ name: 'chat' });

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const singleChatRef = ref<any>(null);

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage & { 
    chatMode?: 'single-chat' | 'parallel-chat' | 'tool-trace' | 'test'
};

// 创建 messages
if (!tabStorage.messages) {
    tabStorage.messages = [] as ChatMessage[];
}

// 创建 ID
if (!tabStorage.id) {    
    tabStorage.id = uuidv4();
}

// 初始化聊天模式相关数据
if (tabStorage.chatMode === undefined) {
    tabStorage.chatMode = 'single-chat';
}
if (!tabStorage.parallelChats) {
    tabStorage.parallelChats = [];
}
if (!tabStorage.selectedModels) {
    tabStorage.selectedModels = [];
}

// 聊天模式状态
const chatMode = computed({
    get: () => tabStorage.chatMode || 'single-chat',
    set: (value: 'single-chat' | 'parallel-chat' | 'tool-trace') => {
        tabStorage.chatMode = value;
    }
});

const selectedModels = computed({
    get: () => tabStorage.selectedModels || [],
    set: (value: string[]) => {
        tabStorage.selectedModels = value;
    }
});

// 动态LLM配置管理
const originalLlmsLength = ref(0);

// 可用模型列表 - 支持同一供应商多模型
const availableModels = computed(() => {
    const models: Array<{
        id: string;
        name: string;
        configIndex: number;
        modelName: string;
        providerName: string;
        isMultiModel: boolean;
    }> = [];
    
    // 遍历原始LLM配置
    llms.forEach((llm, configIndex) => {
        if (llm.models && llm.models.length > 1) {
            // 如果有多个模型，为每个模型创建选项
            llm.models.forEach((model, modelIndex) => {
                models.push({
                    id: `${configIndex}:${modelIndex}`,
                    name: `${model} (${llm.name})`,
                    configIndex,
                    modelName: model,
                    providerName: llm.name,
                    isMultiModel: true
                });
            });
        } else {
            // 单模型或使用userModel
            models.push({
                id: `${configIndex}:0`,
                name: `${llm.userModel || llm.models?.[0] || 'unknown'} (${llm.name})`,
                configIndex,
                modelName: llm.userModel || llm.models?.[0],
                providerName: llm.name,
                isMultiModel: false
            });
        }
    });
    
    return models;
});

// 搜索关键词
const searchKeyword = ref('');

// 筛选后的模型列表
const filteredModels = computed(() => {
    if (!searchKeyword.value.trim()) {
        return availableModels.value;
    }
    
    const keyword = searchKeyword.value.toLowerCase().trim();
    return availableModels.value.filter(model => {        
        // 支持搜索：模型名称、供应商名称、完整显示名称
        return model.modelName?.toLowerCase().includes(keyword) ||
               model.providerName?.toLowerCase().includes(keyword) ||
               model.name?.toLowerCase().includes(keyword);
    });
});

// 自定义筛选方法
function filterModels(query: string) {
    searchKeyword.value = query;
    return true; // 返回true让el-select使用computed filteredModels
}

// 创建临时LLM配置
function createTempLlmConfig(baseConfig: any, modelName: string, tempIndex: number): any {
    return {
        ...baseConfig,
        id: `${baseConfig.id}_temp_${tempIndex}`,
        userModel: modelName,
        _isTemporary: true,
        _originalIndex: null
    };
}

// 并行聊天实例
const parallelChats = ref<(ParallelChatInstance & { 
    renderMessages: IRenderMessage[], 
    isLoading: boolean, 
    streamingContent: string 
})[]>([]);

// 处理来自子组件的事件
const handleRemoveParallelChat = (event: CustomEvent) => {
    removeParallelChat(event.detail.index);
};

const handleClearChatHistory = (event: CustomEvent) => {
    clearChatHistory(event.detail.index);
};


// 初始化并行聊天
function initParallelChats() {
    console.log('初始化并行聊天, 选择的模型:', selectedModels.value);
    
    // 首先清理之前的临时配置
    cleanupTempConfigs();
    
    // 为选中的模型创建或找到对应的LLM配置索引
    const modelConfigs = selectedModels.value.map(modelId => {
        const [configIndex, modelIndex] = modelId.split(':').map(Number);
        
        // 验证配置索引有效性
        if (configIndex < 0 || configIndex >= llms.length) {
            console.error(`[ERROR] 无效的配置索引: ${configIndex}`);
            return null;
        }
        
        const baseConfig = llms[configIndex];
        const targetModel = baseConfig.models?.[modelIndex] || baseConfig.userModel;
        
        // 如果是原始配置的第一个模型或者用户自定义模型，直接使用原始索引
        if (modelIndex === 0 || !baseConfig.models || baseConfig.models.length <= 1) {
            return {
                modelId,
                llmIndex: configIndex,
                isOriginal: true
            };
        }
        
        // 检查是否已经存在相同的临时配置
        const existingTempIndex = llms.findIndex(llm => 
            llm._isTemporary && 
            llm.id.startsWith(baseConfig.id) && 
            llm.userModel === targetModel
        );
        
        if (existingTempIndex > -1) {
            console.log(`[DEBUG] 复用已存在的临时配置: ${llms[existingTempIndex].id}`);
            return {
                modelId,
                llmIndex: existingTempIndex,
                isOriginal: false
            };
        }
        
        // 创建新的临时配置
        const tempConfig = createTempLlmConfig(baseConfig, targetModel, llms.length);
        llms.push(tempConfig);
        
        console.log(`[DEBUG] 创建新临时配置: ${tempConfig.id}, 模型: ${targetModel}`);
        
        return {
            modelId,
            llmIndex: llms.length - 1,
            isOriginal: false
        };
    }).filter(config => config !== null); // 过滤掉无效配置
    
    parallelChats.value = modelConfigs.map(({ modelId, llmIndex }) => {
        const existingChat = tabStorage.parallelChats?.find(c => c.modelId === modelId);
        return {
            modelId,
            llmIndex, // 存储实际的LLM索引
            messages: existingChat?.messages || [],
            renderMessages: [],
            isLoading: false,
            streamingContent: ''
        };
    });
    
    console.log('创建的并行聊天实例:', parallelChats.value);
    console.log('当前llms长度:', llms.length);
    
    // 更新存储
    tabStorage.parallelChats = parallelChats.value.map(chat => ({
        modelId: chat.modelId,
        messages: chat.messages
    }));
    
    // 为每个聊天实例计算渲染消息
    parallelChats.value.forEach(chat => {
        updateChatRenderMessages(chat);
    });
}

// 移除并行聊天实例
function removeParallelChat(index: number) {
    const removedChat = parallelChats.value[index];
    
    // 清理对应的临时LLM配置
    if (removedChat.llmIndex !== undefined && removedChat.llmIndex < llms.length && llms[removedChat.llmIndex]?._isTemporary) {
        llms.splice(removedChat.llmIndex, 1);
        
        // 更新其他聊天实例的llmIndex（如果它们的索引大于被删除的索引）
        parallelChats.value.forEach(chat => {
            if (chat.llmIndex !== undefined && removedChat.llmIndex !== undefined && chat.llmIndex > removedChat.llmIndex) {
                chat.llmIndex--;
            }
        });
    }
    
    // 从数组中移除聊天实例
    parallelChats.value.splice(index, 1);
    selectedModels.value = selectedModels.value.filter(id => id !== removedChat.modelId);
    
    // 更新存储
    tabStorage.parallelChats = parallelChats.value.map(chat => ({
        modelId: chat.modelId,
        messages: chat.messages
    }));
    
    // 如果没有剩余的并行聊天了，自动退出并行模式
    if (parallelChats.value.length === 0) {
        chatMode.value = 'single-chat';
        cleanupTempConfigs();
    }
}

// 清空聊天记录（上下文）
function clearChatHistory(index: number) {
    // 确定要清空此对话的上下文吗？
    const chat = parallelChats.value[index];
    chat.messages = [];
    chat.renderMessages = [];
    chat.streamingContent = '';
    
    // 更新存储
    tabStorage.parallelChats = parallelChats.value.map(chat => ({
        modelId: chat.modelId,
        messages: chat.messages
    }));
    
    console.log(`模型 ${chat.modelId} 的上下文已清空`);
}


// 更新聊天实例的渲染消息  
async function updateChatRenderMessages(chat: ParallelChatInstance & { renderMessages: IRenderMessage[] }, streamingToolCalls?: ToolCall[]) {
    console.log(`[DEBUG] updateChatRenderMessages 被调用，模型: ${chat.modelId}，流式工具调用:`, streamingToolCalls?.length || 0);
    
    // 如果只是流式工具调用更新，使用增量更新避免重建整个数组
    if (streamingToolCalls !== undefined) {
        console.log(`[DEBUG] 模型 ${chat.modelId} 进行流式工具调用更新`);
        // 移除之前的流式工具调用（如果存在）
        while (chat.renderMessages.length > 0) {
            const lastMessage = chat.renderMessages[chat.renderMessages.length - 1];
            if (
                lastMessage.role === 'assistant/tool_calls' &&
                lastMessage.extraInfo?.serverName === chat.modelId &&
                lastMessage.extraInfo?.state === MessageState.Unknown &&
                !lastMessage.content
            ) {
                chat.renderMessages.pop();
            } else {
                break;
            }
        }
        
        streamingToolCalls.forEach((call, index) => {
            const normalisedCall = {
                id: call.id || `streaming_${index}`,
                type: call.type || 'function',
                index,
                function: {
                    name: call.function?.name || '',
                    arguments: call.function?.arguments || '{}'
                }
            };
            chat.renderMessages.push({
                role: 'assistant/tool_calls',
                content: '',
                toolResults: [[]],
                tool_calls: [normalisedCall],
                toolIndex: index,
                showJson: ref(false),
                extraInfo: {
                    created: Date.now(),
                    state: MessageState.Unknown,
                    serverName: chat.modelId,
                    enableXmlWrapper: false
                }
            });
        });
        return;
    }
    
    // 完整重建渲染消息（仅在消息数组变化时调用）
    const newRenderMessages: IRenderMessage[] = [];
    
    for (const message of chat.messages) {
        // 使用默认的数字索引适配器，避免并行聊天冲突
        const indexAdapter = (toolCall: any) => toolCall.index || 0;        
        const xmls = getXmlToolCalls(message);

        if (message.role === 'user') {
            if (xmls.length > 0 && message.extraInfo.enableXmlWrapper) {
                const lastAssistantMessage = newRenderMessages[newRenderMessages.length - 1];
                if (lastAssistantMessage && lastAssistantMessage.role === 'assistant/tool_calls') {
                    const toolCallResultXmls = getXmlsFromString(message.content);
                    for (const xml of toolCallResultXmls) {
                        const toolResult = await getToolResultFromXmlString(xml);
                        if (toolResult) {
                            const index = indexAdapter(toolResult.callId);
                            updateToolRenderMessage(newRenderMessages, index, toolResult.toolcallContent, message.extraInfo);
                        }
                    }
                }
            } else {
                newRenderMessages.push({
                    role: 'user',
                    content: message.content,
                    ...(message.richContent && message.richContent.length > 0 && { richContent: message.richContent }),
                    extraInfo: message.extraInfo
                });
            }
        } else if (message.role === 'assistant') {
            if (message.tool_calls) {
                pushAssistantContentMessage(newRenderMessages, message.content, message.extraInfo);
                pushToolRenderMessages(newRenderMessages, message.tool_calls, message.extraInfo);
            } else {
                if (xmls.length > 0 && message.extraInfo.enableXmlWrapper) {
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

                    pushAssistantContentMessage(newRenderMessages, renderAssistantMessage, message.extraInfo);
                    pushToolRenderMessages(newRenderMessages, toolCalls, message.extraInfo);
                } else {
                    newRenderMessages.push({
                        role: 'assistant/content',
                        content: message.content,
                        extraInfo: message.extraInfo
                    });
                }
            }
        } else if (message.role === 'tool') {
            updateToolRenderMessage(newRenderMessages, message.index, message.content, message.extraInfo);
        }
    }
    
    // 一次性更新整个数组，减少响应式触发次数
    console.log(`[DEBUG] 模型 ${chat.modelId} 完整重建渲染消息，共 ${newRenderMessages.length} 条`);
    chat.renderMessages = newRenderMessages;
}

function getXmlToolCalls(message: ChatMessage) {
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

const renderMessages = ref<IRenderMessage[]>([]);

function pushAssistantContentMessage(messages: IRenderMessage[], content: string, extraInfo: ChatMessage['extraInfo']) {
    const normalizedContent = content?.trim();
    if (!normalizedContent) {
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

onMounted(() => {
    initParallelChats();
    
    // 监听来自子组件的事件
    window.addEventListener('removeParallelChat', handleRemoveParallelChat as EventListener);
    window.addEventListener('clearChatHistory', handleClearChatHistory as EventListener);
});

watchEffect(async () => {
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
});

// 添加清空单聊天模式下对话的函数
function clearSingleChat() {
    tabStorage.messages = [];
    renderMessages.value = [];
}

const isLoading = ref(false);

const streamingContent = ref('');
const streamingToolCalls = ref<ToolCall[]>([]);

const chatContainerRef = ref<any>(null);
const messageListRef = ref<any>(null);
const footerRef = ref<any>(null);

const scrollHeight = ref('500px');

function updateScrollHeight() {
    if (chatContainerRef.value && footerRef.value) {
        const containerHeight = chatContainerRef.value.clientHeight;
        const footerHeight = footerRef.value.clientHeight;
        scrollHeight.value = `${containerHeight - footerHeight}px`;
    }
}

provide('updateScrollHeight', updateScrollHeight);

const autoScroll = ref(true);
const scrollbarRef = ref<ScrollbarInstance>();

// 修改后的 handleScroll 方法
const handleScroll = ({ scrollTop, scrollHeight, clientHeight }: {
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number
}) => {
    // 如果用户滚动到接近底部(留10px缓冲)，则恢复自动滚动
    autoScroll.value = scrollTop + clientHeight >= scrollHeight - 10;
};

provide('streamingContent', streamingContent);
provide('streamingToolCalls', streamingToolCalls);
provide('isLoading', isLoading);
provide('autoScroll', autoScroll);

// 提供并行模式相关的数据和方法
provide('chatMode', chatMode);
provide('parallelChats', parallelChats);
provide('updateChatRenderMessages', updateChatRenderMessages);

const chatContext = {
    handleSend: undefined as any,
    handlePlanApprove: undefined as any,
    handlePlanReject: undefined as any,
    handlePlanReplan: undefined as any
};
provide('chatContext', chatContext);

function handlePlanApprove() {
    if (chatContext.handlePlanApprove) {
        chatContext.handlePlanApprove();
    }
}

function handlePlanReject(feedback: string) {
    if (chatContext.handlePlanReject) {
        chatContext.handlePlanReject(feedback);
    }
}

function handlePlanReplan() {
    if (chatContext.handlePlanReplan) {
        chatContext.handlePlanReplan();
    }
}

// 组件卸载时清理临时配置
onBeforeUnmount(() => {
    console.log('[DEBUG] 聊天组件卸载，清理临时配置');
    cleanupTempConfigs();
    
    // 移除事件监听器
    window.removeEventListener('removeParallelChat', handleRemoveParallelChat as EventListener);
    window.removeEventListener('clearChatHistory', handleClearChatHistory as EventListener);
});

// 修改 scrollToBottom 方法
async function scrollToBottom() {
    if (chatMode.value === 'single-chat' && singleChatRef.value) {
        singleChatRef.value.scrollToBottom();
    } else if (chatMode.value === 'parallel-chat') {
        // 在并行模式下，可能需要处理每个并行聊天的滚动
        // 这里可以添加适当的逻辑
    }
}

provide('scrollToBottom', scrollToBottom);

// 添加对 streamingContent 的监听
watch(streamingContent, () => {
    if (autoScroll.value) {
        scrollToBottom();
    }
}, { deep: true });

watch(streamingToolCalls, () => {
    if (autoScroll.value) {
        scrollToBottom();
    }
}, { deep: true });

// 清理临时LLM配置
function cleanupTempConfigs() {
    // 安全地移除所有临时配置，使用倒序遍历避免索引问题
    for (let i = llms.length - 1; i >= 0; i--) {
        if (llms[i]._isTemporary) {
            console.log(`[DEBUG] 清理临时配置: ${llms[i].id}`);
            llms.splice(i, 1);
        }
    }
}
</script>

<style>
.chat-container {
    height: 100%;
    display: flex;
    position: relative;
    flex-direction: column;
    font-size: var(--chat-font-size);
}
</style>
