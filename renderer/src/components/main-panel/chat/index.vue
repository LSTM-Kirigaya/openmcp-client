<template>
    <div class="chat-container" ref="chatContainerRef">
        <el-scrollbar :height="'90%'">
            <div class="message-list">
                <div v-for="(message, index) in messages" :key="index" :class="['message-item', message.role]">
                    <div class="message-avatar" v-if="message.role === 'assistant'">
                        <span class="iconfont icon-chat"></span>
                    </div>
                    <div class="message-content">
                        <div class="message-role">{{ message.role === 'user' ? '' : 'Agent' }}</div>
                        <div class="message-text">
                            <span>{{ message.content }}</span>
                        </div>
                    </div>
                </div>

                <div v-if="isLoading" class="message-item assistant">
                    <div class="message-avatar">
                        <span class="iconfont icon-chat"></span>
                    </div>
                    <div class="message-content">
                        <div class="message-role">Agent</div>
                        <div class="message-text">{{ streamingContent }}<span class="typing-cursor">|</span></div>
                    </div>
                </div>
            </div>
        </el-scrollbar>

        <el-footer class="chat-footer" ref="footerRef">
            <div class="input-area">
                <div class="input-wrapper">
                    <Setting :tabId="tabId" />
                    
                    <el-input v-model="userInput" type="textarea" :rows="inputHeightLines" :maxlength="2000"
                        placeholder="输入消息..." @keydown.enter="handleKeydown" resize="none"
                        class="chat-input" />
                    
                    <el-button
                        type="primary"
                        :loading="isLoading"
                        @click="handleSend"
                        class="send-button"
                        :disabled="!userInput.trim()">
                        <span class="iconfont icon-send"></span>
                    </el-button>
                </div>
            </div>
        </el-footer>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineComponent, defineProps, onUnmounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessageBridge } from "@/api/message-bridge";
import { ElMessage } from 'element-plus';
import { tabs } from '../panel';
import { ChatMessage, ChatStorage } from './chat';

import Setting from './setting.vue';
import { llmManager, llms } from '@/views/setting/llm';

defineComponent({ name: 'chat' });

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage;

const bridge = useMessageBridge();
const userInput = ref('');
const inputHeightLines = computed(() => {
    const currentLines = userInput.value.split('\n').length;
    return Math.min(12, Math.max(5, currentLines));
});

// 创建 messages
if (!tabStorage.messages) {
    tabStorage.messages = [] as ChatMessage[];
}
const messages = tabStorage.messages;

const isLoading = ref(false);
const streamingContent = ref('');
const chatContainerRef = ref<HTMLElement>();
const footerRef = ref<HTMLElement>();
const scrollHeight = ref('500px');

const updateScrollHeight = () => {
    if (chatContainerRef.value && footerRef.value) {
        const containerHeight = chatContainerRef.value.clientHeight;
        const footerHeight = footerRef.value.clientHeight;
        scrollHeight.value = `${containerHeight - footerHeight}px`;
    }
};

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
    }
    // Shift+Enter 允许自然换行
};

const handleSend = () => {
    if (!userInput.value.trim() || isLoading.value) return;

    const userMessage = userInput.value.trim();
    messages.push({ role: 'user', content: userMessage });

    // 后端接受属性 baseURL, apiKey, model, messages, temperature
    const baseURL = llms[llmManager.currentModelIndex].baseUrl;
    const apiKey = llms[llmManager.currentModelIndex].userToken;
    const model = llms[llmManager.currentModelIndex].userModel;
    const temperature = tabStorage.settings.temperature;

    const userMessages = [];
    if (tabStorage.settings.systemPrompt) {
        userMessages.push({
            role: 'system',
            content: tabStorage.settings.systemPrompt
        });
    }
    // 如果超出了 tabStorage.settings.contextLength, 则删除最早的消息
    const loadMessages = messages.slice(-tabStorage.settings.contextLength);
    userMessages.push(...loadMessages);

    const chatData = {
        baseURL,
        apiKey,
        model,
        temperature,
        messages: userMessages,
    };

    isLoading.value = true;
    streamingContent.value = '';

    bridge.postMessage({
        command: 'llm/chat/completions',
        data: chatData
    });

    userInput.value = '';
};

const handleError = (errorMsg: string) => {
    ElMessage.error(errorMsg);
    messages.push({
        role: 'assistant',
        content: `错误: ${errorMsg}`
    });
    streamingContent.value = '';
    isLoading.value = false;
};

onMounted(() => {
    updateScrollHeight();
    window.addEventListener('resize', updateScrollHeight);

    bridge.addCommandListener('llm/chat/completions/chunk', data => {
        if (data.code !== 200) {
            handleError(data.msg || '请求模型服务时发生错误');
            return;
        }
        const { content } = data.msg;
        if (content) {
            streamingContent.value += content;
        }
    }, { once: false });

    bridge.addCommandListener('llm/chat/completions/done', data => {
        if (data.code !== 200) {
            handleError(data.msg || '模型服务处理完成但返回错误');
            return;
        }
        if (streamingContent.value) {
            messages.push({
                role: 'assistant',
                content: streamingContent.value
            });
            streamingContent.value = '';
        }
        isLoading.value = false;
    }, { once: false });
});

onUnmounted(() => {
    window.removeEventListener('resize', updateScrollHeight);
});
</script>

<style scoped>
.chat-container {
    height: 100%;
    display: flex;
    position: relative;
    flex-direction: column;
}

.message-list {
    max-width: 800px;
    margin: 0 auto;
    padding: 16px;
    padding-bottom: 100px;
}

.message-item {
    display: flex;
    margin-bottom: 16px;
}

.message-avatar {
    margin-right: 12px;
}

.message-content {
    flex: 1;
    width: 100%;
}

.message-role {
    font-weight: bold;
    margin-bottom: 4px;
    color: var(--el-text-color-regular);
}

.message-text {
    line-height: 1.6;
    white-space: pre-wrap;
}

.user .message-text {
    margin-top: 10px;
    margin-bottom: 10px;
}

.user .message-text > span {
    border-radius: .9em;
    background-color: var(--main-light-color);
    padding: 10px 15px;
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

.assistant {
    text-align: left;
    margin-top: 30px;
}

.chat-footer {
    padding: 16px;
    border-top: 1px solid var(--el-border-color);
    flex-shrink: 0;
    position: absolute;
    height: fit-content;
    bottom: 0;
    width: 100%;
}

.input-area {
    max-width: 800px;
    margin: 0 auto;
    position: relative;
}

.input-wrapper {
    position: relative;
}

.chat-input {
    padding-right: 80px;
}

.chat-input textarea {
    border-radius: .5em;
}

.send-button {
    position: absolute !important;
    right: 8px !important;
    bottom: 8px !important;
    height: auto;
    padding: 8px 12px;
    font-size: 20px;
    border-radius: .5em;
}

:deep(.chat-settings) {
    position: absolute;
    left: 0;
    bottom: 8px;
    z-index: 1;
}
.typing-cursor {
    animation: blink 1s infinite;
}

@keyframes blink {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0;
    }
}
</style>