<template>
    <div class="chat-container" :ref="el => chatContainerRef = el">
        <el-scrollbar ref="scrollbarRef" :height="'90%'" @scroll="handleScroll">
            <div class="message-list" :ref="el => messageListRef = el">
                <div v-for="(message, index) in renderMessages" :key="index"
                    :class="['message-item', message.role.split('/')[0]]">
                    <div class="message-avatar" v-if="message.role.split('/')[0] === 'assistant'">
                        <span class="iconfont icon-robot"></span>
                    </div>

                    <!-- 用户输入的部分 -->
                    <div class="message-content" v-if="message.role === 'user'">
                        <div class="message-role"></div>
                        <div class="message-text">
                            <span>{{ message.content }}</span>
                        </div>
                    </div>

                    <!-- 助手返回的内容部分 -->
                    <div class="message-content" v-else-if="message.role === 'assistant/content'">
                        <div class="message-role">Agent</div>
                        <div class="message-text">
                            <div v-if="message.content" v-html="markdownToHtml(message.content)"></div>
                        </div>
                    </div>

                    <!-- 助手调用的工具部分 -->
                    <div class="message-content" v-else-if="message.role === 'assistant/tool_calls'">
                        <div class="message-role">
                            Agent
                            <span class="message-reminder" v-if="!message.toolResult">
                                正在使用工具
                                <span class="tool-loading iconfont icon-double-loading">
                                </span>
                            </span>
                        </div>
                        <div class="message-text tool_calls">
                            <div v-if="message.content" v-html="markdownToHtml(message.content)"></div>
                            
                            <div class="tool-calls">
                                <div v-for="(call, index) in message.tool_calls" :key="index" class="tool-call-item">
                                    <div class="tool-call-header">
                                        <span class="tool-name">{{ call.function.name }}</span>
                                        <span class="tool-type">{{ call.type }}</span>
                                    </div>
                                    <div class="tool-arguments">
                                        <div class="inner">
                                            <div v-html="jsonResultToHtml(call.function.arguments)"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 工具调用结果 -->
                            <div v-if="message.toolResult">
                                <div class="tool-call-header">
                                    <span class="tool-name">{{ "响应" }}</span>
                                    <span style="width: 200px;" class="tools-dialog-container">
                                        <el-switch
                                            v-model="message.showJson!.value"
                                            inline-prompt
                                            active-text="JSON"
                                            inactive-text="Text"
                                            style="margin-left: 10px; width: 200px;"
                                            :inactive-action-style="'backgroundColor: var(--sidebar)'"
                                        />
                                    </span>
                                </div>
                                <div class="tool-result" v-if="isValidJSON(message.toolResult)">
                                    <div v-if="message.showJson!.value" class="tool-result-content">
                                        <div class="inner">
                                            <div v-html="jsonResultToHtml(message.toolResult)"></div>
                                        </div>
                                    </div>
                                    <span v-else>
                                        <div v-for="(item, index) in JSON.parse(message.toolResult)" :key="index">
                                            <div v-if="item.type === 'text'" class="tool-text">{{ item.text }}</div>
                                            <div v-else class="tool-other">{{ JSON.stringify(item) }}</div>
                                        </div>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 正在加载的部分实时解析 markdown -->
                <div v-if="isLoading" class="message-item assistant">
                    <div class="message-avatar">
                        <span class="iconfont icon-chat"></span>
                    </div>
                    <div class="message-content">
                        <div class="message-role">
                            Agent
                            <span class="message-reminder">
                                正在生成答案
                                <span class="tool-loading iconfont icon-double-loading">
                                </span>
                            </span>
                        </div>
                        <div class="message-text">
                            <span v-html="waitingMarkdownToHtml(streamingContent)"></span>
                        </div>
                    </div>
                </div>
            </div>
        </el-scrollbar>

        <el-footer class="chat-footer" ref="footerRef">
            <div class="input-area">
                <div class="input-wrapper">
                    <Setting :tabId="tabId" />

                    <el-input v-model="userInput" type="textarea" :rows="inputHeightLines" :maxlength="2000"
                        placeholder="输入消息..." @keydown.enter="handleKeydown" resize="none" class="chat-input" />

                    <el-button type="primary" @click="isLoading ? handleAbort() : handleSend()" class="send-button">
                        <span v-if="!isLoading" class="iconfont icon-send"></span>
                        <span v-else class="iconfont icon-stop"></span>
                    </el-button>
                </div>
            </div>
        </el-footer>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineComponent, defineProps, onUnmounted, computed, nextTick, watch, Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ScrollbarInstance } from 'element-plus';
import { tabs } from '../panel';
import { ChatMessage, ChatStorage, getToolSchema, ToolCall } from './chat';

import Setting from './setting.vue';
// 引入 markdown.ts 中的函数
import { markdownToHtml, copyToClipboard } from './markdown';
import { TaskLoop } from './task-loop';

defineComponent({ name: 'chat' });

const { t } = useI18n();

function waitingMarkdownToHtml(content: string) {
    if (content) {
        return markdownToHtml(content);
    }
    return '<span class="typing-cursor">|</span>';
}

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage;

const userInput = ref('');
const inputHeightLines = computed(() => {
    const currentLines = userInput.value.split('\n').length;
    return Math.min(12, Math.max(5, currentLines));
});

// 创建 messages
if (!tabStorage.messages) {
    tabStorage.messages = [] as ChatMessage[];
}

interface IRenderMessage {
    role: 'user' | 'assistant/content' | 'assistant/tool_calls' | 'tool';
    content: string;
    toolResult?: string;
    tool_calls?: ToolCall[];
    showJson?: Ref<boolean>;
}

const renderMessages = computed(() => {
    const messages: IRenderMessage[] = [];
    for (const message of tabStorage.messages) {
        if (message.role === 'user') {
            messages.push({
                role: 'user',
                content: message.content
            });
        } else if (message.role === 'assistant') {
            if (message.tool_calls) {
                messages.push({
                    role: 'assistant/tool_calls',
                    content: message.content,
                    tool_calls: message.tool_calls,
                    showJson: ref(false)
                });
            } else {
                messages.push({
                    role: 'assistant/content',
                    content: message.content
                });
            }

        } else if (message.role === 'tool') {
            // 如果是工具，则合并进入 之前 assistant 一起渲染
            const lastAssistantMessage = messages[messages.length - 1];
            if (lastAssistantMessage.role === 'assistant/tool_calls') {
                lastAssistantMessage.toolResult = message.content;
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

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
    }
    // Shift+Enter 允许自然换行
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

const handleSend = () => {
    if (!userInput.value.trim() || isLoading.value) return;

    autoScroll.value = true;
    isLoading.value = true;

    const userMessage = userInput.value.trim();

    loop = new TaskLoop(streamingContent, streamingToolCalls);

    loop.registerOnError((msg) => {
        ElMessage({
            message: msg,
            type: 'error',
            duration: 3000
        });

        tabStorage.messages.push({
            role: 'assistant',
            content: `错误: ${msg}`
        });

        isLoading.value = false;
    });

    loop.registerOnChunk((chunk) => {
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

onMounted(() => {
    updateScrollHeight();
    window.addEventListener('resize', updateScrollHeight);
    scrollToBottom();
});

onUnmounted(() => {
    window.removeEventListener('resize', updateScrollHeight);
});

// 新增辅助函数检查是否为有效JSON
const isValidJSON = (str: string) => {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
};

const jsonResultToHtml = (jsonString: string) => {
    const formattedJson = JSON.stringify(JSON.parse(jsonString), null, 2);
    const html = markdownToHtml('```json\n' + formattedJson + '\n```');
    return html;
};

// 新增格式化工具参数的方法
const formatToolArguments = (args: string) => {
    try {
        const parsed = JSON.parse(args);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return args;
    }
};

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
}

.message-text.tool_calls {
    border-left: 3px solid var(--main-color);
    padding-left: 10px;
}

.user .message-text {
    margin-top: 10px;
    margin-bottom: 10px;
}

.user .message-text>span {
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
</style>

<style scoped>
/* 原有样式保持不变 */

/* 新增工具调用样式 */
.tool-calls {
    margin-top: 10px;
}

.tool-call-item {
    margin-bottom: 10px;
}

.tool-call-header {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
}

.tool-name {
    font-weight: bold;
    color: var(--el-color-primary);
    margin-right: 8px;
    margin-bottom: 0;
    display: flex;
    align-items: center;
    height: 26px;
}

.tool-type {
    font-size: 0.8em;
    color: var(--el-text-color-secondary);
    background-color: var(--el-fill-color-light);
    padding: 2px 6px;
    display: flex;
    align-items: center;
    border-radius: 4px;
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

/* 新增样式来减小行距 */
.message-text p,
.message-text h3,
.message-text ol,
.message-text ul {
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    line-height: 1.4;
    /* 可以根据需要调整行高 */
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