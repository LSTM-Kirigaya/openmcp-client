<template>
	<div class="resource-template-container-scrollbar">
		<el-scrollbar height="500px">
			<div class="resource-template-container">
				<div
					class="item"
                    :class="{ 'active': tabStorage.currentResourceName === template.name }"
					v-for="template of resourcesManager.templates"
					:key="template.name"
                    @click="handleClick(template)"
				>
					<span>{{ template.name }}</span>
					<span>{{ template.description || '' }}</span>
				</div>
			</div>
		</el-scrollbar>
	</div>
    <div class="resource-template-function-container">
        <el-button
            type="primary"
            @click="reloadResources({ first: false })"
        >
            {{ t('refresh') }}
        </el-button>
    </div>
</template>

<script setup lang="ts">
import { useMessageBridge } from '@/api/message-bridge';
import { CasualRestAPI, ResourceTemplate, ResourceTemplatesListResponse } from '@/hook/type';
import { onMounted, onUnmounted, defineProps } from 'vue';
import { useI18n } from 'vue-i18n';
import { resourcesManager, ResourceStorage } from './resources';
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
const tabStorage = tab.storage as ResourceStorage;

function reloadResources(option: { first: boolean }) {    
    bridge.postMessage({
        command: 'resources/templates/list'
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

function handleClick(template: ResourceTemplate) {
    tabStorage.currentResourceName = template.name;
    // TODO: 恢复这部分响应？
    tabStorage.lastResourceReadResponse = undefined;
}

let commandCancel: (() => void);

onMounted(() => {
    commandCancel = bridge.addCommandListener('resources/templates/list', (data: CasualRestAPI<ResourceTemplatesListResponse>) => {
		resourcesManager.templates = data.msg.resourceTemplates || [];

        if (resourcesManager.templates.length > 0) {
            tabStorage.currentResourceName = resourcesManager.templates[0].name;
            // TODO: 恢复这部分响应？
            tabStorage.lastResourceReadResponse = undefined;
        }
	}, { once: false });

    reloadResources({ first: true });
});

onUnmounted(() => {
    if (commandCancel){
        commandCancel();
    }
})

</script>

<style>
.resource-template-container-scrollbar {
	background-color: var(--background);
    margin-bottom: 10px;
	border-radius: .5em;
}

.resource-template-container {
	height: fit-content;
	display: flex;
	flex-direction: column;
	padding: 10px;
}

.resource-template-function-container {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.resource-template-function-container button {
    width: 175px;
}

.resource-template-container > .item {
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

.resource-template-container > .item:hover {
	background-color: var(--main-light-color);
	transition: var(--animation-3s);
}

.resource-template-container > .item.active {
	background-color: var(--main-light-color);
	transition: var(--animation-3s);
}

.resource-template-container > .item > span:first-child {
	max-width: 200px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.resource-template-container > .item > span:last-child {
	opacity: 0.6;
	font-size: 12.5px;
	max-width: 200px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

</style>