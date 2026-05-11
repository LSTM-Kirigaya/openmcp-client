<template>
	<div class="chat-settings">
		<Model />
		<Skill />
		<ToolUse />
		<Prompt />
		<Resource />
		<ParallelToolCalls />
		<Temperature />
		<ContextLength />
		<XmlWrapper />
		<Export />
	</div>
</template>

<script setup lang="ts">
import { provide, computed, inject } from 'vue';
import type { Ref } from 'vue';
import { llmManager } from '@/views/setting/llm';
import { tabs } from '@/components/main-panel/panel';
import type { ChatSetting, ChatStorage } from '../chat';

import Model from './model.vue';
import Skill from './skill.vue';
import ToolUse from './tool-use.vue';
import Prompt from './prompt.vue';
import Resource from './resource.vue';
import ParallelToolCalls from './parallel-tool-calls.vue';
import Temperature from './temperature.vue';
import ContextLength from './context-length.vue';
import XmlWrapper from './xml-wrapper.vue';
import Export from './export.vue';

const props = defineProps({
	modelValue: {
		type: String,
		required: true
	},
	tabId: {
		type: Number,
		required: true
	}
});

const emits = defineEmits(['update:modelValue']);

const modelValue = computed({
	get() {
		return props.modelValue;
	},
	set(value) {
		emits('update:modelValue', value);
	}
});


const injectedStorage = inject<Ref<ChatStorage | null> | (ChatStorage & { settings?: ChatSetting }) | null>('batchValidationStorage', null);
const tab = props.tabId >= 0 ? tabs.content[props.tabId] : null;
const tabStorage = (injectedStorage && typeof (injectedStorage as any).value !== 'undefined'
	? (injectedStorage as Ref<ChatStorage | null>).value
	: (injectedStorage as ChatStorage | null)) ?? (tab?.storage ?? null);

if (tabStorage) {
	if (!tabStorage.settings) {
		tabStorage.settings = {
			modelIndex: llmManager.currentModelIndex,
			enableTools: [],
			enableWebSearch: false,
			temperature: 0.6,
			contextLength: 100,
			systemPrompt: '',
			enableXmlWrapper: false,
			parallelToolCalls: true
		} as ChatSetting;
	}
	provide('tabStorage', tabStorage);
}

</script>

<style>
.chat-settings {
	display: flex;
	gap: 2px;
	padding: 8px 0;
	width: fit-content;
	border-radius: 99%;
	left: 5px;
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
	background-color: var(--foreground);
	color: var(--background);
	transition: var(--animation-3s);
}

.setting-button.active:hover {
	background-color: var(--foreground);
	opacity: 0.9;
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
}

.tool-description {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.el-switch__core {
	border: 1px solid var(--main-color) !important;
}

.el-switch .el-switch__action {
	background-color: var(--main-color);
}

.el-switch.is-checked .el-switch__action {
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
	color: var(--background);
	background-color: var(--foreground);
	border-radius: 50%;
	padding: 2px 6px;
	font-size: 10px;
	z-index: 10;
	top: -16px;
	right: -18px;
	box-shadow: 0 0 6px rgba(0, 0, 0, 0.2);
}
</style>