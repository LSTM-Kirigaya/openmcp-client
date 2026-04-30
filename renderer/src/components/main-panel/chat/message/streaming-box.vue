<template>
    <div class="message-avatar streaming-box">
        <span class="iconfont icon-chat"></span>
    </div>
    <div class="message-content">
        <div class="message-role">
            Agent
        </div>
        <div class="message-text streaming-box">
            <span class="inline-spinner tool-loading iconfont icon-double-loading"></span>
            <span v-html="waitingMarkdownToHtml(streamingContent)"></span>
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
.inline-spinner {
    display: inline-block;
    margin-right: 6px;
    animation: spin 1s linear infinite;
    color: var(--main-color);
    font-size: 14px;
    vertical-align: middle;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>
