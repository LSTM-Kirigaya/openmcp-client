<template>
    <div class="resource-logger">
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
                    <span v-for="(content, index) of tabStorage.lastResourceReadResponse?.contents || []" :key="index">
                        {{ content.text }}
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
import { ResourceStorage } from './resources';

defineComponent({ name: 'resource-logger' });
const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ResourceStorage;

const showRawJson = ref(false);

const formattedJson = computed(() => {
    try {
        return JSON.stringify(tabStorage.lastResourceReadResponse, null, 2);
    } catch {
        return 'Invalid JSON';
    }
});
</script>

<style>
.resource-logger {
    border-radius: .5em;
    background-color: var(--background);
    padding: 10px;
}

.resource-logger .el-switch__core {
    border: 1px solid var(--main-color) !important;
    width: 60px !important;
}

.resource-logger .el-switch .el-switch__action {
    background-color: var(--main-color);
}

.resource-logger .el-switch.is-checked .el-switch__action {
    background-color: var(--sidebar);
}

.resource-logger > span:first-child {
    margin-bottom: 5px;
    display: flex;
    align-items: center;
}

.resource-logger .output-content {
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