<template>
    <div class="tool-list-container-scrollbar">
        <el-scrollbar height="500px">
            <div class="tool-list-container">
                <div
                    class="item"
                    :class="{ 'active': tabStorage.currentToolName === tool.name }"
                    v-for="tool of toolsManager.tools"
                    :key="tool.name"
                    @click="handleClick(tool)"
                >
                    <span>{{ tool.name }}</span>
                    <span>{{ tool.description || '' }}</span>
                </div>
            </div>
        </el-scrollbar>
    </div>
    <div class="tool-list-function-container">
        <el-button
            type="primary"
            @click="reloadTools({ first: false })"
        >
            {{ t('refresh') }}
        </el-button>
    </div>
</template>

<script setup lang="ts">
import { useMessageBridge } from '@/api/message-bridge';
import { CasualRestAPI, ToolsListResponse } from '@/hook/type';
import { onMounted, onUnmounted, defineProps } from 'vue';
import { useI18n } from 'vue-i18n';
import { toolsManager, ToolStorage } from './tools';
import { tabs } from '../panel';
import { ElMessage } from 'element-plus';

const bridge = useMessageBridge();
const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ToolStorage;

function reloadTools(option: { first: boolean }) {    
    bridge.postMessage({
        command: 'tools/list'
    });

    if (!option.first) {
        ElMessage({
            message: t('finish-refresh'),
            type: 'success',
            duration: 3000,
            showClose: true,
        });
    }
}

function handleClick(tool: { name: string }) {
    tabStorage.currentToolName = tool.name;
    tabStorage.lastToolCallResponse = undefined;
}

let commandCancel: (() => void);

onMounted(() => {
    commandCancel = bridge.addCommandListener('tools/list', (data: CasualRestAPI<ToolsListResponse>) => {
        toolsManager.tools = data.msg.tools || [];
        
        const targetTool = toolsManager.tools.find((tool) => {
            return tool.name === tabStorage.currentToolName;
        });

        if (targetTool === undefined) {
            tabStorage.currentToolName = toolsManager.tools[0].name;
            tabStorage.lastToolCallResponse = undefined;
        }
    }, { once: false });

    reloadTools({ first: true });
});

onUnmounted(() => {
    if (commandCancel){
        commandCancel();
    }
})
</script>

<style>
.tool-list-container-scrollbar {
    background-color: var(--background);
    margin-bottom: 10px;
    border-radius: .5em;
}

.tool-list-container {
    height: fit-content;
    display: flex;
    flex-direction: column;
    padding: 10px;
}

.tool-list-function-container {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.tool-list-function-container button {
    width: 175px;
}

.tool-list-container > .item {
    margin: 3px;
    padding: 5px 10px;
    border-radius: .3em;
    user-select: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: var(--animation-3s);
}

.tool-list-container > .item:hover {
    background-color: var(--main-light-color);
    transition: var(--animation-3s);
}

.tool-list-container > .item.active {
    background-color: var(--main-light-color);
    transition: var(--animation-3s);
}

.tool-list-container > .item > span:first-child {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tool-list-container > .item > span:last-child {
    opacity: 0.6;
    font-size: 12.5px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>