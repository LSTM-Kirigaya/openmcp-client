<template>
<footer class="chat-footer">
    <div class="input-area">
        <div class="input-wrapper">
            <div class="input-main">
            <!-- Slash 命令面板：输入 / 时显示可选技能 -->
            <div v-if="showSlashMenu" class="slash-menu">
                <div
                    v-for="(skill, idx) in filteredSlashSkills"
                    :key="skill.name"
                    class="slash-menu-item"
                    :class="{ active: slashMenuIndex === idx }"
                    @click="selectSlashSkill(skill)"
                >
                    <span class="iconfont icon-filepath"></span>
                    <span class="slash-menu-name">{{ skill.name }}</span>
                    <span v-if="skill.description" class="slash-menu-desc">{{ skill.description }}</span>
                </div>
                <div v-if="filteredSlashSkills.length === 0" class="slash-menu-empty">
                    {{ t('skill-no-available') || 'No skills configured' }}
                </div>
            </div>

            <KRichTextarea
                :ref="el => editorRef = el"
                :tabId="tabId"
                v-model="userInput"
                :placeholder="t('enter-message-dot')"
                :customClass="'chat-input'"
                @update:rich-content="lastRichContent = $event"
                @press-enter="handleSend()"
                @keydown="(e: KeyboardEvent) => handleSlashKeydown(e)"
            />

            <!-- <button @click="testReflux">test</button> -->

            <el-button type="primary" @click="isLoading ? handleAbort() : handleSend()" class="send-button">
                <span v-if="!isLoading" class="iconfont icon-send"></span>
                <span v-else class="iconfont icon-stop"></span>
            </el-button>
            </div>
        </div>
    </div>
</footer>
</template>

<script setup lang="ts">
import { provide, onMounted, onUnmounted, ref, type PropType, inject, type Ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import KRichTextarea from './rich-textarea.vue';
import { tabs } from '../../panel';
import type { ChatMessage, ChatStorage, ToolCall } from './chat';
import { MessageState } from './chat';

import { TaskLoop } from '../core/task-loop';
import { llmManager, llms } from '@/views/setting/llm';
import { ElMessage } from 'element-plus';
import { v4 as uuidv4 } from 'uuid';
import { listSkills, loadSkillContent, type SkillMetadata } from '@/api/skill';
import { mcpSetting } from '@/hook/mcp';
import {
    EXIT_PLAN_MODE_APPROVED_PROMPT,
    EXIT_PLAN_MODE_REJECTED_PROMPT,
    EXIT_PLAN_MODE_REPLAN_PROMPT
} from '@/api/plan-mode';

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const emits = defineEmits(['update:scrollToBottom']);
const editorRef = ref<any>(null);

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage;

// 创建 messages
if (!tabStorage.messages) {
    tabStorage.messages = [] as ChatMessage[];
}

const userInput = ref<string>('');
/** 输入框最新的 richContent（prompt 卡片等），用于发送时保留卡片形态到历史 */
const lastRichContent = ref<import('./chat').RichTextItem[]>([]);

let loop: TaskLoop | undefined = undefined;

// Slash 命令相关
const showSlashMenu = ref(false);
const slashSkills = ref<SkillMetadata[]>([]);
const slashMenuIndex = ref(0);
const slashQuery = ref('');

const filteredSlashSkills = computed(() => {
    const q = slashQuery.value.toLowerCase().trim();
    if (!q) return slashSkills.value;
    return slashSkills.value.filter(s =>
        s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q))
    );
});

/** skill 文件是否有效（可加载） */
const skillValid = ref(false);
watch(() => mcpSetting.skillPath, async (path) => {
    if (!path?.trim()) {
        skillValid.value = false;
        return;
    }
    const skill = await loadSkillContent();
    skillValid.value = !!skill;
}, { immediate: true });

/** 当前输入的消息是否会包含 skill 上下文：仅当上下文为空且 skill 有效，或通过 /skillname 显式指定且 skill 有效时显示 */
const willIncludeSkill = computed(() => {
    if (!skillValid.value) return false;
    const isContextEmpty = !tabStorage.messages.some((m: ChatMessage) => m.role === 'assistant');
    const hasSlashSkill = !!parseSlashCommand(userInput.value);
    return isContextEmpty || hasSlashSkill;
});

const isLoading = inject('isLoading') as Ref<boolean>;
const autoScroll = inject('autoScroll') as Ref<boolean>;
const streamingContent = inject('streamingContent') as Ref<string>;
const streamingToolCalls = inject('streamingToolCalls') as Ref<ToolCall[]>;
const scrollToBottom = inject('scrollToBottom') as () => Promise<void>;
const updateScrollHeight = inject('updateScrollHeight') as () => void;
const chatContext = inject('chatContext') as any;

// 并行模式相关
const chatMode = inject('chatMode') as Ref<string>;
const parallelChats = inject('parallelChats') as Ref<any[]>;
const updateChatRenderMessages = inject('updateChatRenderMessages') as (chat: any, streamingToolCalls?: ToolCall[]) => Promise<void>;

chatContext.handleSend = handleSend;
chatContext.handlePlanApprove = handlePlanApprove;
chatContext.handlePlanReject = handlePlanReject;
chatContext.handlePlanReplan = handlePlanReplan;

/** 解析 /skillname 格式，返回 [skillName, actualMessage] */
function parseSlashCommand(text: string): { skillName: string; actualMessage: string } | null {
    const match = text.match(/^\s*\/([\w-]+)(?:\s+(.*))?$/s);
    if (!match) return null;
    return {
        skillName: match[1],
        actualMessage: (match[2] || '').trim()
    };
}

async function loadSlashSkills() {
    slashSkills.value = await listSkills();
}

function updateSlashMenu() {
    const match = userInput.value.match(/\/([\w-]*)$/);
    if (match) {
        slashQuery.value = match[1];
        showSlashMenu.value = true;
        slashMenuIndex.value = 0;
        loadSlashSkills();
    } else {
        showSlashMenu.value = false;
    }
}

function selectSlashSkill(skill: SkillMetadata) {
    const match = userInput.value.match(/^(.*)\/([\w-]*)$/);
    const prefix = match ? match[1] : '';
    const insertName = skill.dirName || skill.name;
    userInput.value = prefix + '/' + insertName + ' ';
    showSlashMenu.value = false;
}

function handleSlashKeydown(event: KeyboardEvent) {
    if (!showSlashMenu.value) return;
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        slashMenuIndex.value = Math.min(slashMenuIndex.value + 1, filteredSlashSkills.value.length - 1);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        slashMenuIndex.value = Math.max(slashMenuIndex.value - 1, 0);
    } else if (event.key === 'Enter' && filteredSlashSkills.value.length > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        selectSlashSkill(filteredSlashSkills.value[slashMenuIndex.value]);
    } else if (event.key === 'Escape') {
        event.preventDefault();
        showSlashMenu.value = false;
    }
}

watch(userInput, () => updateSlashMenu());

function clearErrorMessage(errorMessage: string) {
    try {
        const errorObject = JSON.parse(errorMessage);
        if (errorObject.error) {
            return errorObject.error;
        }
        if (errorObject.message) {
            return errorObject.message;
        }
        if (errorObject.msg) {
            return errorObject.msg;
        }
    } catch (error) {
        return errorMessage;
    }
}

async function handleSend(newMessage?: string, richContentOverride?: import('./chat').RichTextItem[]) {
    let userMessage = newMessage || userInput.value;

    if (!userMessage || isLoading.value) {
        return;
    }

    // 解析 /skillname 手动触发
    const slashParsed = parseSlashCommand(userMessage);
    if (slashParsed) {
        (tabStorage as any)._skillOverrideForNextMessage = slashParsed.skillName;
        userMessage = slashParsed.actualMessage || userMessage;
    }

    // 判断本次消息是否会包含 skill 上下文（用于在消息上显示 SKILL 标识）
    const noHistory = !tabStorage.messages.some((m: ChatMessage) => m.role === 'assistant');
    const skillContent = await loadSkillContent(slashParsed?.skillName);
    const hasSkillContext = !!skillContent && (!!slashParsed || noHistory);

    // 重新回答时传入的 richContent 优先；否则用输入框最新 richContent 或现场提取，确保 prompt 卡片形态保存到历史
    const richContent = richContentOverride ?? (lastRichContent.value?.length ? lastRichContent.value : editorRef.value?.extractRichContent?.() ?? []);

    // 清空文本（同时清空 lastRichContent 避免下次误用）
    userInput.value = '';
    lastRichContent.value = [];
    showSlashMenu.value = false;
    const editor = editorRef.value?.editor;
    if (editor) {
        editor.innerHTML = '';
    }

    if (chatMode.value === 'parallel-chat' && parallelChats.value.length > 0) {
        handleParallelSend(userMessage, richContent, hasSkillContext, slashParsed);
    } else {
        handleSingleSend(userMessage, richContent, hasSkillContext);
    }
}

function testReflux() {    
    loop = new TaskLoop();
    loop.bindStreaming(streamingContent, streamingToolCalls);
    loop.reflux(tabStorage);
}


function handleSingleSend(userMessage: string, richContent: import('./chat').RichTextItem[] = [], hasSkillContext = false) {
    isLoading.value = true;
    autoScroll.value = true;

    // 先推送用户消息（含富文本），再让 TaskLoop 使用 __SKIP_USER_MESSAGE__
    tabStorage.messages.push({
        role: 'user',
        content: userMessage,
        ...(richContent.length > 0 && { richContent }),
        extraInfo: {
            created: Date.now(),
            state: MessageState.Success,
            serverName: llms[llmManager.currentModelIndex].id || 'unknown',
            enableXmlWrapper: tabStorage.settings.enableXmlWrapper,
            hasSkillContext
        }
    });


    loop = new TaskLoop();
    loop.bindStreaming(streamingContent, streamingToolCalls);

    console.log(tabStorage);
    

    loop.registerOnError((error) => {
        const errorMessage = clearErrorMessage(error.msg);
        ElMessage.error(errorMessage);

        if (error.state === MessageState.ReceiveChunkError) {
            tabStorage.messages.push({
                role: 'assistant',
                content: errorMessage,
                extraInfo: {
                    created: Date.now(),
                    state: error.state,
                    serverName: llms[llmManager.currentModelIndex].id || 'unknown',
                    enableXmlWrapper: false
                }
            });
        }
    });

    loop.registerOnChunk(() => {
        scrollToBottom();
    });

    loop.registerOnDone(() => {
        scrollToBottom();
    });

    loop.registerOnEpoch(() => {
        isLoading.value = true;
        scrollToBottom();
    });

    loop.start(tabStorage, '__SKIP_USER_MESSAGE__', { mode: 'single-chat' }).then(() => {
        isLoading.value = false;
        delete (tabStorage as any)._skillOverrideForNextMessage;
    });
}

function handleParallelSend(
    userMessage: string,
    richContent: import('./chat').RichTextItem[] = [],
    hasSkillContext = false,
    slashParsedFromSend?: { skillName: string; actualMessage: string } | null
) {
    isLoading.value = true;
    // handleSend 已剥离 /skillname，userMessage 即为实际内容
    const actualUserMessage = userMessage;

    // 为每个并行聊天实例启动独立的对话
    const parallelPromises = parallelChats.value.map(async (chat, index) => {
        // 添加用户消息到这个聊天实例（含富文本）
        chat.messages.push({
            role: 'user',
            content: actualUserMessage,
            ...(richContent.length > 0 && { richContent }),
            extraInfo: {
                created: Date.now(),
                state: MessageState.Success,
                serverName: chat.modelId,
                enableXmlWrapper: tabStorage.settings.enableXmlWrapper,
                hasSkillContext
            }
        });

        // 设置这个聊天实例为加载中
        chat.isLoading = true;
        chat.streamingContent = '';

        // 立即更新渲染消息以显示用户输入
        await updateChatRenderMessages(chat);

        // 创建独立的TaskLoop实例，避免状态共享
        const chatLoop = new TaskLoop({
            maxEpochs: tabStorage.settings.contextLength || 5,
            verbose: 0
        });
        
        const targetModelIndex = chat.llmIndex;
        
        try {
            // 为这个聊天实例创建完全独立的存储，包含独立的模型配置
            const chatStorage = {
                id: uuidv4(),
                messages: [...chat.messages], // 深拷贝消息
                settings: {
                    ...tabStorage.settings,
                    // 强制设置当前模型索引，避免全局状态冲突
                    currentModelIndex: targetModelIndex,
                    // 关闭并行工具调用，避免索引冲突
                    parallelToolCalls: false
                },
                _skillOverrideForNextMessage: slashParsedFromSend?.skillName
            };
            
            // 动态注入模型索引到 chatLoop 的上下文中
            (chatLoop as any)._targetModelIndex = targetModelIndex;
            
            // 绑定流式输出到这个聊天实例
            const chatStreamingContent = ref('');
            const chatStreamingToolCalls = ref<ToolCall[]>([]);
            chatLoop.bindStreaming(chatStreamingContent, chatStreamingToolCalls);

            // 监听流式内容变化
            const stopWatchStreaming = watch(chatStreamingContent, (newContent) => {
                console.log(`[DEBUG] 模型 ${chat.modelId} 流式内容更新:`, newContent.slice(0, 50) + '...');
                chat.streamingContent = newContent;
            });

            // 防抖更新函数
            let updateTimer: NodeJS.Timeout | null = null;
            const debouncedUpdate = (newToolCalls: ToolCall[]) => {
                if (updateTimer) {
                    clearTimeout(updateTimer);
                }
                updateTimer = setTimeout(async () => {
                    await updateChatRenderMessages(chat, newToolCalls);
                    updateTimer = null;
                }, 50);
            };

            // 监听流式工具调用变化
            const stopWatchToolCalls = watch(chatStreamingToolCalls, (newToolCalls) => {
                console.log(`[DEBUG] 模型 ${chat.modelId} 工具调用更新:`, newToolCalls.length, '个工具调用');
                debouncedUpdate(newToolCalls);
            }, { deep: true });

            chatLoop.registerOnError((error) => {
                console.log(`[DEBUG] 模型 ${chat.modelId} 出错:`, error.msg);
                const errorMessage = clearErrorMessage(error.msg);
                
                chat.messages.push({
                    role: 'assistant',
                    content: errorMessage,
                    extraInfo: {
                        created: Date.now(),
                        state: error.state,
                        serverName: chat.modelId,
                        enableXmlWrapper: false
                    }
                });

                chat.isLoading = false;
                
                updateChatRenderMessages(chat);
            });

            chatLoop.registerOnDone(() => {
                chat.isLoading = false;
                chat.streamingContent = '';
                stopWatchStreaming();
                stopWatchToolCalls();
                if (updateTimer) {
                    clearTimeout(updateTimer);
                    updateTimer = null;
                }
            });

            // 临时保存和恢复模型索引，确保TaskLoop使用正确的模型
            const savedModelIndex = llmManager.currentModelIndex;
            if (targetModelIndex >= 0 && targetModelIndex < llms.length) {
                console.log(`[DEBUG] 模型 ${chat.modelId} 切换模型: ${savedModelIndex} -> ${targetModelIndex}`);
                llmManager.currentModelIndex = targetModelIndex;
            }
            
            console.log(`[DEBUG] 模型 ${chat.modelId} 开始TaskLoop执行，当前全局模型索引: ${llmManager.currentModelIndex}`);
            await chatLoop.start(chatStorage, '__SKIP_USER_MESSAGE__');
            console.log(`[DEBUG] 模型 ${chat.modelId} TaskLoop执行完成`);
            
            // 立即恢复模型索引
            if (savedModelIndex !== llmManager.currentModelIndex) {
                console.log(`[DEBUG] 模型 ${chat.modelId} 恢复模型: ${llmManager.currentModelIndex} -> ${savedModelIndex}`);
                llmManager.currentModelIndex = savedModelIndex;
            }
            
            // 更新存储中的消息
            chat.messages = chatStorage.messages;
            
            // 重新计算渲染消息
            await updateChatRenderMessages(chat);
            
        } catch (error) {
            console.error(`并行聊天 ${chat.modelId} 出错:`, error);
            chat.isLoading = false;
            chat.streamingContent = '';
        }
    });

    // 等待所有并行请求完成
    Promise.all(parallelPromises).then(() => {
        isLoading.value = false;
        
        // 更新存储
        tabStorage.parallelChats = parallelChats.value.map(chat => ({
            modelId: chat.modelId,
            messages: chat.messages
        }));
    });
}

function handleAbort() {
    if (loop) {
        loop.abort();
        isLoading.value = false;
        ElMessage.info('请求已中止');
    }
}

async function handlePlanApprove() {
    // 退出 plan mode
    if (tabStorage.planMode) {
        tabStorage.planMode.isPlanMode = false;
    }
    // 发送批准消息，触发 AI 实施
    await handleSend(EXIT_PLAN_MODE_APPROVED_PROMPT);
}

async function handlePlanReject(feedback: string) {
    // 保持 plan mode，发送反馈消息
    await handleSend(EXIT_PLAN_MODE_REJECTED_PROMPT(feedback));
}

async function handlePlanReplan() {
    // 保持 plan mode，发送 replan 消息
    await handleSend(EXIT_PLAN_MODE_REPLAN_PROMPT);
}


onMounted(() => {
    updateScrollHeight();
    window.addEventListener('resize', updateScrollHeight);
    scrollToBottom();
});

onUnmounted(() => {
    window.removeEventListener('resize', updateScrollHeight);
});


</script>

<style scoped>
.chat-footer {
    padding: 12px 16px 16px;
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
    display: flex;
    align-items: stretch;
    gap: 8px;
}

.input-main {
    flex: 1;
    position: relative;
    min-width: 0;
}


.skill-badge-text {
    letter-spacing: 0.5px;
}

/* 与批量测试输入框完全一致：Element Plus el-input__wrapper 风格 */
:deep(.input-main .k-rich-textarea) {
    min-height: 160px;
    border: none !important;
    border-radius: 8px;
    padding: 6px 11px 1px 11px;
    box-shadow: 0 0 0 1px var(--el-input-border-color, var(--el-border-color)) inset;
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    transition: var(--el-transition-box-shadow);
    font-size: var(--el-font-size-base);
    outline: none;
}

:deep(.input-main .k-rich-textarea:hover) {
    box-shadow: 0 0 0 1px var(--main-light-color-70) inset !important;
    outline: none;
    transition: var(--el-transition-box-shadow);
}

:deep(.input-main .k-rich-textarea:focus-within) {
    box-shadow: 0 0 0 1px var(--main-light-color-70) inset !important;
    outline: none;
    transition: var(--el-transition-box-shadow);
}

:deep(.input-main .rich-editor) {
    min-height: 120px;
    color: var(--el-input-text-color, var(--el-text-color-regular));
}

:deep(.input-main .rich-editor:empty::before) {
    color: var(--el-input-placeholder-color, var(--el-text-color-placeholder));
}

.send-button {
    position: absolute !important;
    right: 8px !important;
    bottom: 8px !important;
    height: 32px;
    min-width: 32px;
    padding: 6px 12px;
    font-size: var(--chat-font-size);
    border-radius: 8px !important;
    background-color: var(--main-light-color-20) !important;
    border: 1px solid var(--main-light-color-50) !important;
    color: var(--main-color) !important;
}
.send-button:hover {
    background-color: var(--main-light-color-40) !important;
    border-color: var(--main-light-color-70) !important;
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

/* Slash 命令面板 */
.slash-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 80px;
    margin-bottom: 4px;
    max-height: 200px;
    overflow-y: auto;
    background: var(--el-input-bg-color, var(--el-fill-color-blank));
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
}

.slash-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: var(--chat-font-size);
    color: var(--foreground);
    border-bottom: 1px solid var(--border);
    transition: background 0.2s;
}

.slash-menu-item:last-child {
    border-bottom: none;
}

.slash-menu-item:hover,
.slash-menu-item.active {
    background: var(--el-fill-color-light);
}

.slash-menu-name {
    font-weight: 500;
    flex-shrink: 0;
}

.slash-menu-desc {
    font-size: var(--chat-font-size-sm);
    color: var(--el-text-color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.slash-menu-empty {
    padding: 16px;
    font-size: var(--chat-font-size-sm);
    color: var(--el-text-color-secondary);
    text-align: center;
}
</style>