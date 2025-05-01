<template>
    <div class="chat-container" :ref="el => chatContainerRef = el">
        <el-scrollbar ref="scrollbarRef" :height="'90%'" @scroll="handleScroll" v-if="renderMessages.length > 0 || isLoading">
            <div class="message-list" :ref="el => messageListRef = el">
                <div v-for="(message, index) in renderMessages" :key="index"
                    :class="['message-item', message.role.split('/')[0], message.role.split('/')[1]]"
                >
                    <div class="message-avatar" v-if="message.role === 'assistant/content'">
                        <span class="iconfont icon-robot"></span>
                    </div>
                    <div class="message-avatar" v-else-if="message.role === 'assistant/tool_calls'">
                    </div>

                    <!-- 用户输入的部分 -->
                    <div class="message-content" v-if="message.role === 'user'">
                        <Message.User :message="message" :tab-id="props.tabId" />
                    </div>

                    <!-- 助手返回的内容部分 -->
                    <div class="message-content" v-else-if="message.role === 'assistant/content'">
                        <Message.Assistant :message="message" :tab-id="props.tabId" />
                    </div>

                    <!-- 助手调用的工具部分 -->
                    <div class="message-content" v-else-if="message.role === 'assistant/tool_calls'">
                        <Message.Toolcall
                            :message="message" :tab-id="props.tabId"
                            @update:tool-result="(value, index) => (message.toolResult || [])[index] = value"
                        />
                    </div>
                </div>

                <!-- 正在加载的部分实时解析 markdown -->
                <div v-if="isLoading" class="message-item assistant">
                    <Message.StreamingBox :streaming-content="streamingContent" :tab-id="props.tabId" />
                </div>
            </div>
        </el-scrollbar>
        <div v-else class="chat-openmcp-icon">
            <div>
                <!-- <span class="iconfont icon-openmcp"></span> -->
                <span>{{ t('press-and-run') }}

                    <span style="padding: 5px 15px; border-radius: .5em; background-color: var(--background);">
                        <span class="iconfont icon-send"></span>
                    </span>

                </span>
            </div>
        </div>

        <footer class="chat-footer" ref="footerRef">
            <div class="input-area">
                <div class="input-wrapper">
                    <Setting :tabId="tabId" />

                    <KCuteTextarea
                        v-model="userInput"
                        placeholder="输入消息..."
                        :customClass="'chat-input'"
                        @press-enter="handleSend()"
                    />

                    <el-button type="primary" @click="isLoading ? handleAbort() : handleSend()" class="send-button">
                        <span v-if="!isLoading" class="iconfont icon-send"></span>
                        <span v-else class="iconfont icon-stop"></span>
                    </el-button>
                </div>
            </div>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineComponent, defineProps, onUnmounted, computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ScrollbarInstance } from 'element-plus';
import { tabs } from '../panel';
import { ChatMessage, ChatStorage, IRenderMessage, MessageState, ToolCall } from './chat';

import { TaskLoop } from './task-loop';
import { llmManager, llms } from '@/views/setting/llm';

import * as Message from './message';
import Setting from './options/setting.vue';
import KCuteTextarea from '@/components/k-cute-textarea/index.vue';

import { provide } from 'vue';

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

const userInput = ref('');

// 创建 messages
if (!tabStorage.messages) {
    tabStorage.messages = [] as ChatMessage[];
}

const renderMessages = computed(() => {
    const messages: IRenderMessage[] = [];
    for (const message of tabStorage.messages) {
        if (message.role === 'user') {
            messages.push({
                role: 'user',
                content: message.content,
                extraInfo: message.extraInfo
            });
        } else if (message.role === 'assistant') {
            if (message.tool_calls) {
                messages.push({
                    role: 'assistant/tool_calls',
                    content: message.content,
                    tool_calls: message.tool_calls,
                    showJson: ref(false),
                    extraInfo: {
                        ...message.extraInfo,
                        state: MessageState.Unknown
                    }
                });
            } else {
                messages.push({
                    role: 'assistant/content',
                    content: message.content,
                    extraInfo: message.extraInfo
                });
            }

        } else if (message.role === 'tool') {
            // 如果是工具，则合并进入 之前 assistant 一起渲染
            const lastAssistantMessage = messages[messages.length - 1];
            if (lastAssistantMessage.role === 'assistant/tool_calls') {
                lastAssistantMessage.toolResult = message.content;
                lastAssistantMessage.extraInfo.state = message.extraInfo.state;
                lastAssistantMessage.extraInfo.usage = lastAssistantMessage.extraInfo.usage || message.extraInfo.usage;
            }
        }
    }

    return messages;
});

const isLoading = ref(false);

const streamingContent = ref('');
const streamingToolCalls = ref<ToolCall[]>([]);

const chatContainerRef = ref<any>(null);
const messageListRef = ref<any>(null);

const footerRef = ref<HTMLElement>();
const scrollHeight = ref('500px');

const updateScrollHeight = () => {
    if (chatContainerRef.value && footerRef.value) {
        const containerHeight = chatContainerRef.value.clientHeight;
        const footerHeight = footerRef.value.clientHeight;
        scrollHeight.value = `${containerHeight - footerHeight}px`;
    }
};


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

// 修改 scrollToBottom 方法
const scrollToBottom = async () => {
    if (!scrollbarRef.value || !messageListRef.value) return;

    await nextTick(); // 等待 DOM 更新

    try {
        const container = scrollbarRef.value.wrapRef;
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    } catch (error) {
        console.error('Scroll to bottom failed:', error);
    }
};

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

let loop: TaskLoop | undefined = undefined;

const handleSend = (newMessage?: string) => {
    const userMessage = newMessage || userInput.value.trim();
    if (!userMessage || isLoading.value) return;

    autoScroll.value = true;
    isLoading.value = true;

    loop = new TaskLoop(streamingContent, streamingToolCalls);

    loop.registerOnError((error) => {

        ElMessage({
            message: error.msg,
            type: 'error',
            duration: 3000
        });
        
        if (error.state === MessageState.ReceiveChunkError) {
            tabStorage.messages.push({
                role: 'assistant',
                content: error.msg,
                extraInfo: {
                    created: Date.now(),
                    state: error.state,
                    serverName: llms[llmManager.currentModelIndex].id || 'unknown'
                }
            });
        }

        isLoading.value = false;
    });

    loop.registerOnChunk(() => {
        scrollToBottom();
    });

    loop.registerOnDone(() => {
        isLoading.value = false;
        scrollToBottom();
    });

    loop.registerOnEpoch(() => {
        isLoading.value = true;
        scrollToBottom();
    });


    loop.start(tabStorage, userMessage);
    userInput.value = '';
};

const handleAbort = () => {
    if (loop) {
        loop.abort();
        isLoading.value = false;
        ElMessage.info('请求已中止');
    }
};

provide('handleSend', handleSend);

onMounted(() => {
    updateScrollHeight();
    window.addEventListener('resize', updateScrollHeight);
    scrollToBottom();
});

onUnmounted(() => {
    window.removeEventListener('resize', updateScrollHeight);
});

</script>

<style>
.chat-container {
    height: 100%;
    display: flex;
    position: relative;
    flex-direction: column;
}

.chat-openmcp-icon {
    width: 100%;
    display: flex;
    justify-content: center;
    height: 100%;
    opacity: 0.75;
    padding-top: 70px;
}

.chat-openmcp-icon > div {
    display: flex;
    flex-direction: column;
    align-items: left;
    font-size: 28px;
}

.chat-openmcp-icon > div > span {
    margin-bottom: 23px;
}

.chat-openmcp-icon .iconfont {
    font-size: 22px;
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
    margin-top: 1px;
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
}

.user .message-text {
    margin-top: 10px;
    margin-bottom: 10px;
    width: 100%;
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

.assistant.tool_calls {
    margin-top: 5px;
}

.chat-footer {
    padding: 16px;
    border-top: 1px solid var(--el-border-color);
    flex-shrink: 0;
    position: absolute;
    height: fit-content !important;
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
    border-radius: 1.2em !important;
}

:deep(.chat-settings) {
    position: absolute;
    left: 0;
    bottom: 0px;
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

.message-text p,
.message-text h3,
.message-text ol,
.message-text ul {
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    line-height: 1.4;
}

.message-text ol li,
.message-text ul li {
    margin-top: 0.2em;
    margin-bottom: 0.2em;
}

/* 新增旋转标记样式 */
.tool-loading {
    display: inline-block;
    margin-left: 8px;
    animation: spin 1s linear infinite;
    color: var(--main-color);
    font-size: 20px;
}


@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}


</style>
