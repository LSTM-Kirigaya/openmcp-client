<template>
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
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import { markdownToHtml } from '../markdown/markdown';

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

<style>
</style>