<template>
	<div class="chat-settings">
		<Model />
		<SystemPrompt />
		<ToolUse />
		<Websearch />
		<Temperature />
		<ContextLength />
	</div>
</template>

<script setup lang="ts">
import { defineProps, provide } from 'vue';
import { llmManager } from '@/views/setting/llm';
import { tabs } from '../../panel';
import type { ChatSetting, ChatStorage } from '../chat';

import Model from './model.vue';
import SystemPrompt from './system-prompt.vue';
import ToolUse from './tool-use.vue';
import Websearch from './websearch.vue';
import Temperature from './temperature.vue';
import ContextLength from './context-length.vue';

const props = defineProps({
	tabId: {
		type: Number,
		required: true
	}
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage & { settings: ChatSetting };

if (!tabStorage.settings) {
	tabStorage.settings = {
		modelIndex: llmManager.currentModelIndex,
		enableTools: [],
		enableWebSearch: false,
		temperature: 0.7,
		contextLength: 10,
		systemPrompt: ''
	} as ChatSetting;
}

provide('tabStorage', tabStorage);

</script>

<style>
.chat-settings {
	display: flex;
	gap: 2px;
	padding: 8px 0;
	background-color: var(--sidebar);
	width: fit-content;
	border-radius: 99%;
	bottom: 0px;
	z-index: 10;
	position: absolute;
}

.setting-button {
	padding: 5px 8px;
	margin-right: 3px;
	border-radius: .5em;
	font-size: 12px;
	position: relative;
	user-select: none;
	-webkit-user-drag: none;
	display: flex;
	align-items: center;
	cursor: pointer;
	transition: var(--animation-3s);
}

.setting-button.active {
	background-color: var(--el-color-primary);
	color: var(--el-text-color-primary);
	transition: var(--animation-3s);
}

.setting-button.active:hover {
	background-color: var(--el-color-primary);
	transition: var(--animation-3s);
}

.setting-button:hover {
	background-color: var(--background);
	transition: var(--animation-3s);
}

.value-badge {
	font-size: 10px;
	padding: 1px 4px;
	border-radius: 4px;
}

.slider-container {
	padding: 0 10px;
}

.slider-tips {
	display: flex;
	justify-content: space-between;
	margin-top: 10px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

/* 新增工具相关样式 */
.tools-container {
	padding: 10px;
}

.tool-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 0;
	border-bottom: 1px solid var(--el-border-color-light);
}

.tool-info {
	flex: 1;
	margin-right: 20px;
}

.tool-name {
	font-weight: 500;
	margin-bottom: 4px;
}

.tool-description {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.tools-dialog-container .el-switch__core {
	border: 1px solid var(--main-color) !important;
}


.tools-dialog-container .el-switch .el-switch__action {
	background-color: var(--main-color);
}

.tools-dialog-container .el-switch.is-checked .el-switch__action {
	background-color: var(--sidebar);
}

/* 新增工具对话框样式 */
.tools-dialog-container {
	display: flex;
	gap: 16px;
}

.tools-list {
	flex: 1;
	border-right: 1px solid var(--el-border-color);
	padding-right: 16px;
}

.schema-viewer {
	flex: 1;
}

.schema-viewer pre {
	margin: 0;
	border-radius: 4px;
	white-space: pre-wrap;
	word-wrap: break-word;
	background-color: var(--el-bg-color-overlay);
}

.schema-viewer .openmcp-code-block {
	border: none;
}

.schema-viewer code {
	font-family: var(--code-font-family);
	font-size: 12px;
	color: var(--el-text-color-primary);
}

.badge-outer {
	position: relative;
}

.badge-inner {
	position: absolute;
	color: var(--foreground);
	background-color: var(--main-color);
	border-radius: 50%;
	padding: 2px 6px;
	font-size: 10px;
	top: -16px;
	right: -18px;
	box-shadow: 0 0 6px rgba(0, 0, 0, 0.2);
}
</style>