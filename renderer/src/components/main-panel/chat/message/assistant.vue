<template>
    <div class="message-role">Agent</div>
    <div class="message-text">
        <div v-if="message.content" v-html="markdownToHtml(props.message.content)"></div>
    </div>
    <MessageMeta :message="props.message" />
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import { markdownToHtml } from '../markdown/markdown';

import MessageMeta from './message-meta.vue';

const props = defineProps({
    message: {
        type: Object,
        required: true
    },
    tabId: {
        type: Number,
        required: true
    }
});

</script>

<style>
</style>