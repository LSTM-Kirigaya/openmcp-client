<template>
    <div class="message-avatar streaming-box">
        <span class="iconfont icon-chat"></span>
    </div>
    <div class="message-content">
        <div class="message-role">
            Agent
        </div>

        <!-- Thinking / Loading 容器 -->
        <div class="thinking-container">
            <div class="thinking-header">
                <span class="thinking-icon tool-loading iconfont icon-double-loading"></span>
                <span class="thinking-label">{{ t('generate-answer') }}</span>
            </div>
            <div class="thinking-body">
                <span v-html="waitingMarkdownToHtml(streamingContent)"></span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import { useI18n } from 'vue-i18n';
import { markdownToHtml } from '@/components/main-panel/chat/markdown/markdown';

const { t } = useI18n();

const props = defineProps({
    streamingContent: {
        type: String,
        required: true
    },
    tabId: {
        type: Number,
        required: true
    }
});

function waitingMarkdownToHtml(content: string) {
    if (content) {
        return markdownToHtml(content);
    }
    return '<span class="typing-cursor">|</span>';
}

</script>

<style scoped>
.thinking-container {
    border: 1px solid var(--sidebar-item-border);
    border-radius: 8px;
    background: var(--el-input-bg-color, var(--el-fill-color-blank));
    overflow: hidden;
    margin-top: 4px;
}

.thinking-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--sidebar-item-selected);
    border-bottom: 1px solid var(--sidebar-item-border);
    font-size: var(--chat-font-size-sm);
    color: var(--el-text-color-secondary);
    min-height: 36px;
}

.thinking-icon {
    font-size: 16px;
    color: var(--main-color);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
}

.thinking-label {
    font-weight: 500;
    color: var(--foreground);
}

.thinking-body {
    padding: 10px 12px;
    font-size: var(--chat-font-size);
    line-height: 1.5;
    color: var(--foreground);
    min-height: 40px;
}

.thinking-body :deep(.typing-cursor) {
    color: var(--main-color);
}
</style>
