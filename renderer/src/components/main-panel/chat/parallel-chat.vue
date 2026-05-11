<template>
    <div class="parallel-chat-container">
        <div 
            v-for="(chat, chatIndex) in parallelChats" 
            :key="chat.modelId"
            class="parallel-chat-instance"
            :style="{ width: `${100 / parallelChats.length}%` }"
        >
            <div class="chat-header">
                <span class="model-name">{{ getModelName(chat.modelId) }}</span>
                <div class="chat-actions">
                      <el-popconfirm title="确定要清空此对话的上下文吗？"
                        @confirm="clearChatHistory(chatIndex)"
                      >
                        <template #reference>
                            <el-button 
                                type="warning"
                                title="清空上下文"
                            >
                                {{ t('clear') }}
                            </el-button>
                        </template>
                    </el-popconfirm>

                    <el-button 
                        @click="removeParallelChat(chatIndex)" 
                        type="danger"
                        title="移除此对话"
                    >
                        <span class="iconfont icon-delete"></span>
                    </el-button>
                </div>
            </div>
            <el-scrollbar :height="'85%'" 
                v-if="chat.renderMessages.length > 0 || chat.isLoading">
                <div class="message-list">
                    <div v-for="(message, index) in chat.renderMessages" :key="index"
                        :class="['message-item', message.role.split('/')[0], message.role.split('/')[1]]">
                        <div class="message-avatar" v-if="message.role === 'assistant/content'">
                            <span class="iconfont icon-robot"></span>
                        </div>
                        <div class="message-avatar" v-else-if="message.role === 'assistant/tool_calls'">
                        </div>
                        <div class="message-avatar user-avatar" v-else-if="message.role === 'user'">
                            <span class="user-avatar-mark">U</span>
                        </div>

                        <div class="message-content" v-if="message.role === 'user'">
                            <Message.User :message="message" :tab-id="props.tabId" />
                        </div>

                        <div class="message-content" v-else-if="message.role === 'assistant/content'">
                            <Message.Assistant :message="message" :tab-id="props.tabId" />
                        </div>

                        <div class="message-content" v-else-if="message.role === 'assistant/tool_calls'">
                            <Message.Toolcall :message="message" :tab-id="props.tabId"
                                @update:tool-result="(value, toolIndex, index) => message.toolResults[toolIndex][index] = value" />
                        </div>
                    </div>

                    <div v-if="chat.isLoading" class="message-item assistant">
                        <Message.StreamingBox :streaming-content="chat.streamingContent" :tab-id="props.tabId" />
                    </div>
                </div>
            </el-scrollbar>
            <div v-else class="chat-openmcp-icon">
                <div>
                    <span>{{ getModelName(chat.modelId) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineProps, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { tabs } from '../panel';
import type { ChatMessage, ChatStorage, IRenderMessage, ToolCall, ParallelChatInstance } from './chat-box/chat';

import * as Message from './message';
import { llms } from '@/views/setting/llm';

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    },
    selectedModels: {
        type: Array as () => string[],
        required: true
    },
    parallelChats: {
        type: Array as () => (ParallelChatInstance & { 
            renderMessages: IRenderMessage[], 
            isLoading: boolean, 
            streamingContent: string 
        })[],
        required: true
    },
    streamingContent: {
        type: String,
        required: true
    },
    streamingToolCalls: {
        type: Array as () => ToolCall[],
        required: true
    },
    isLoading: {
        type: Boolean,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage;

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

// 移除并行聊天实例
function removeParallelChat(index: number) {
    // 这个函数将在父组件中实现
    const event = new CustomEvent('removeParallelChat', { detail: { index } });
    window.dispatchEvent(event);
}

// 清空聊天记录（上下文）
function clearChatHistory(index: number) {
    // 这个函数将在父组件中实现
    const event = new CustomEvent('clearChatHistory', { detail: { index } });
    window.dispatchEvent(event);
}

// 获取模型名称
function getModelName(modelId: string) {
    if (modelId.includes(':')) {
        // 新格式：configIndex:modelIndex
        const [configIndex, modelIndex] = modelId.split(':').map(Number);
        if (!isNaN(configIndex) && configIndex >= 0 && configIndex < llms.length) {
            const llm = llms[configIndex];
            const model = llm.models?.[modelIndex] || llm.userModel;
            return `${model} (${llm.name})`;
        }
    } else {
        // 兼容旧格式
        const index = parseInt(modelId);
        if (!isNaN(index) && index >= 0 && index < llms.length) {
            const llm = llms[index];
            return `${llm.userModel || llm.models?.[0] || 'unknown'} (${llm.name})`;
        }
    }
    return modelId;
}
</script>

<style>
.parallel-chat-container {
    display: flex;
    height: calc(90% - 50px);
    gap: 2px;
    flex: 1;
}

.parallel-chat-instance {
    border-right: 1px solid var(--background);
    display: flex;
    flex-direction: column;
}

.parallel-chat-instance:last-child {
    border-right: none;
}

.chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    border-bottom: 1px solid var(--background);
    font-size: var(--chat-font-size-sm);
    font-weight: bold;
}

.model-name {
    color: var(--main-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}

.parallel-chat-instance .message-list {
    max-width: none;
    margin: 0;
    padding: 8px;
    padding-bottom: 50px;
}

.parallel-chat-instance .chat-openmcp-icon {
    padding-top: 30px;
    font-size: var(--chat-font-size);
}

.parallel-chat-instance .message-item {
    margin-bottom: 12px;
}

.parallel-chat-instance .message-avatar {
    margin-right: 8px;
}

.parallel-chat-instance .user .message-avatar {
    margin-right: 0;
    margin-left: 8px;
}

.parallel-chat-container .chat-actions .el-button {
    border-radius: 16px !important;
    background-color: var(--foreground) !important;
    color: var(--background) !important;
    border-color: var(--foreground) !important;
}

.parallel-chat-container .chat-actions .el-button:hover {
    background-color: var(--foreground) !important;
    color: var(--background) !important;
    opacity: 0.9;
}
</style>
