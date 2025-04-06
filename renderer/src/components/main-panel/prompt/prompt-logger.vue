<template>
    <div class="prompt-logger">
        <span>
            <span>{{ t('response') }}</span>
            <span style="width: 200px;">
                <el-switch
                    v-model="showRawJson"
                    inline-prompt
                    active-text="JSON"
                    inactive-text="Text"
                    style="margin-left: 10px; width: 200px;"
                    :inactive-action-style="'backgroundColor: var(--sidebar)'"
                />
            </span>
        </span>
        <el-scrollbar height="350px">
            <div
                class="output-content"
                contenteditable="false"
            >
                <template v-if="!showRawJson">
                    <span v-for="(message, index) of tabStorage.lastPromptGetResponse?.messages || []" :key="index">
                        {{ message.content.text }}
                    </span>
                </template>
                <template v-else>
                    {{ formattedJson }}
                </template>
            </div>
        </el-scrollbar>
    </div>
</template>

<script setup lang="ts">
import { defineComponent, defineProps, computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { tabs } from '../panel';
import { PromptStorage } from './prompts';

defineComponent({ name: 'prompt-logger' });
const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as PromptStorage;

const showRawJson = ref(false);

const formattedJson = computed(() => {
    try {
        return JSON.stringify(tabStorage.lastPromptGetResponse, null, 2);
    } catch {
        return 'Invalid JSON';
    }
});
</script>

<style>
.prompt-logger {
    border-radius: .5em;
    background-color: var(--background);
    padding: 10px;
}

.prompt-logger .el-switch__core {
    border: 1px solid var(--main-color) !important;
    width: 60px !important;
}

.prompt-logger .el-switch .el-switch__action {
    background-color: var(--main-color);
}

.prompt-logger .el-switch.is-checked .el-switch__action {
    background-color: var(--sidebar);
}

.prompt-logger > span:first-child {
    margin-bottom: 5px;
    display: flex;
    align-items: center;
}

.prompt-logger .output-content {
    border-radius: .5em;
    padding: 15px;
    min-height: 300px;
    height: fit-content;
    font-family: var(--code-font-family);
    white-space: pre-wrap;
    word-break: break-all;
    user-select: text;
    cursor: text;
    font-size: 15px;
    line-height: 1.5;
    background-color: var(--sidebar);
}
</style>