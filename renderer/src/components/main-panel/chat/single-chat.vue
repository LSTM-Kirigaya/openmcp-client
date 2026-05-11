<template>
    <el-scrollbar ref="scrollbarRef" :height="'90%'" @scroll="handleScroll"
        v-if="renderMessages.length > 0 || isLoading">
        <div class="message-list" :ref="el => messageListRef = el">
            <div v-for="(message, index) in renderMessages" :key="index"
                :class="['message-item', message.role.split('/')[0], message.role.split('/')[1]]">
                <div class="message-avatar" v-if="message.role === 'assistant/content'">
                    <span class="iconfont icon-robot"></span>
                </div>
                <div class="message-avatar" v-else-if="message.role === 'assistant/tool_calls'">
                </div>
                <div class="message-avatar user-avatar" v-else-if="message.role === 'user'">
                    <span class="user-avatar-mark">U</span>
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
                    <Message.Toolcall :message="message" :tab-id="props.tabId"
                        @update:tool-result="(value, toolIndex, index) => message.toolResults[toolIndex][index] = value"
                        @plan-approve="handlePlanApprove"
                        @plan-reject="handlePlanReject"
                        @plan-replan="handlePlanReplan" />
                </div>
            </div>

            <!-- 正在加载的部分实时解析 markdown -->
            <!-- 当已有正在等待的 tool_calls 消息时，不再重复显示 StreamingBox，
                 避免 toolcall.vue 和 StreamingBox 同时出现造成视觉冲突 -->
            <div v-if="isLoading && !hasPendingToolCalls" class="message-item assistant">
                <AskUserQuestion
                    v-if="pendingQuestion"
                    :questions="pendingQuestion.questions"
                    @answer="handleAskUserQuestionAnswer"
                />
                <Message.StreamingBox v-else :streaming-content="streamingContent" :tab-id="props.tabId" />
            </div>
        </div>
    </el-scrollbar>
    <div v-else class="chat-openmcp-icon">
        <div>
            <span>{{ t('press-and-run') }}
                <span style="padding: 6px 14px; border-radius: 4px; background-color: var(--el-input-bg-color, var(--el-fill-color-blank)); border: 1px solid var(--border);">
                    <span class="iconfont icon-send"></span>
                </span>
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineProps, nextTick, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type ScrollbarInstance } from 'element-plus';
import { tabs } from '../panel';
import { MessageState, type ChatStorage, type IRenderMessage } from './chat-box/chat';

import * as Message from './message';
import AskUserQuestion from './message/ask-user-question.vue';
import { resolveAskUserQuestion } from '@/api/plan-mode';

const { t } = useI18n();

const emits = defineEmits(['plan-approve', 'plan-reject', 'plan-replan']);

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    },
    renderMessages: {
        type: Array as () => IRenderMessage[],
        required: true
    },
    streamingContent: {
        type: String,
        required: true
    },
    isLoading: {
        type: Boolean,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage;

const pendingQuestion = computed(() => {
    const p = (tabStorage as any)._pendingAskUserQuestion;
    return p && p.questions ? p : null;
});

// 检查最后一个渲染消息是否是正在等待 tool results 的 assistant/tool_calls
const hasPendingToolCalls = computed(() => {
    return props.renderMessages.some(message =>
        message.role === 'assistant/tool_calls' &&
        message.extraInfo.state === MessageState.Unknown
    );
});

const chatContainerRef = ref<any>(null);
const messageListRef = ref<any>(null);
const scrollbarRef = ref<ScrollbarInstance>();

const autoScroll = ref(true);

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
async function scrollToBottom() {
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
}

function handlePlanApprove() {
    emits('plan-approve');
}

function handlePlanReject(feedback: string) {
    emits('plan-reject', feedback);
}

function handlePlanReplan() {
    emits('plan-replan');
}

function handleAskUserQuestionAnswer(answers: Record<string, string>) {
    resolveAskUserQuestion(tabStorage.id, answers);
}

defineExpose({
    scrollToBottom
});
</script>

<style>
.chat-openmcp-icon {
    width: 100%;
    display: flex;
    justify-content: center;
    height: 100%;
    opacity: 0.75;
    padding-top: 70px;
}

.chat-openmcp-icon>div {
    display: flex;
    flex-direction: column;
    align-items: left;
    font-size: var(--chat-font-size);
    color: var(--foreground);
}

.chat-openmcp-icon>div>span {
    margin-bottom: 16px;
}

.chat-openmcp-icon .iconfont {
    font-size: 16px;
}

.message-list {
    max-width: 800px;
    margin: 0 auto;
    padding: 12px;
    padding-bottom: 40px;
}

.message-item {
    display: flex;
    margin-bottom: 12px;
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
    font-size: var(--chat-font-size);
    color: var(--el-text-color-regular);
}

.message-list .message-item:last-child {
    margin-bottom: 100px;
}

.message-text {
    font-size: var(--chat-font-size);
    line-height: 1.5;
}

.user .message-text {
    margin-top: 8px;
    margin-bottom: 8px;
    width: 100%;
}

.user .message-text>span {
    border-radius: 6px;
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    padding: 8px 12px;
    border: 1px solid var(--sidebar-item-border);
}

.user {
    flex-direction: row-reverse;
    text-align: right;
    align-items: center;
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
    margin-top: 12px;
}

.assistant.tool_calls {
    margin-top: 4px;
}

.message-text p,
.message-text h3,
.message-text ol,
.message-text ul {
    margin-top: 0.4em;
    margin-bottom: 0.4em;
    line-height: 1.4;
}

.message-text ol li,
.message-text ul li {
    margin-top: 0.15em;
    margin-bottom: 0.15em;
}

/* 新增旋转标记样式 */
.tool-loading {
    display: inline-block;
    margin-left: 8px;
    animation: spin 1s linear infinite;
    color: var(--main-color);
    font-size: 18px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}
</style>
