<template>
    <div class="tool-logger">
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
        <el-scrollbar height="300px">
            <div
                class="output-content"
                contenteditable="false"
            >
                <template v-if="!showRawJson">
                    <template v-if="tabStorage.lastToolCallResponse?.isError">
                        <span style="color: var(--el-color-error)">
                            {{ tabStorage.lastToolCallResponse.content.map(c => c.text).join('\n') }}
                        </span>
                    </template>
                    <template v-else>
                        {{ tabStorage.lastToolCallResponse?.content.map(c => c.text).join('\n') }}
                    </template>
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
import { ToolStorage } from './tools';

defineComponent({ name: 'tool-logger' });
const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ToolStorage;

const showRawJson = ref(false);

const formattedJson = computed(() => {
    try {
        return JSON.stringify(tabStorage.lastToolCallResponse, null, 2);
    } catch {
        return 'Invalid JSON';
    }
});
</script>

<style>
.tool-logger {
    border-radius: .5em;
    background-color: var(--background);
    padding: 10px;
}

.tool-logger .el-switch__core {
    border: 1px solid var(--main-color) !important;
    width: 60px !important;
}

.tool-logger .el-switch .el-switch__action {
    background-color: var(--main-color);
}

.tool-logger .el-switch.is-checked .el-switch__action {
    background-color: var(--sidebar);
}

.tool-logger > span:first-child {
    margin-bottom: 5px;
    display: flex;
    align-items: center;
}

.tool-logger .output-content {
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