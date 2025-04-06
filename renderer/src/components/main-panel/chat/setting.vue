<template>
	<div class="chat-settings">
		<el-tooltip content="选择模型" placement="top">
			<div class="setting-button" size="small" @click="showModelDialog = true">
				<span class="iconfont icon-model">
					{{ llms[llmManager.currentModelIndex].name }}/{{
						llms[llmManager.currentModelIndex].models[selectedModelIndex] }}
				</span>
			</div>
		</el-tooltip>

		<el-tooltip content="系统提示词" placement="top">
			<div class="setting-button" :class="{ 'active': hasSystemPrompt }" size="small"
				@click="showSystemPromptDialog = true">
				<span class="iconfont icon-robot"></span>
			</div>
		</el-tooltip>

		<el-tooltip content="工具使用" placement="top">
			<div class="setting-button" :class="{ 'active': tabStorage.settings.enableTools }" size="small"
				@click="toggleTools">
				<span class="iconfont icon-tool"></span>
			</div>
		</el-tooltip>

		<el-tooltip content="网络搜索" placement="top">
			<div class="setting-button" :class="{ 'active': tabStorage.settings.enableWebSearch }" size="small"
				@click="toggleWebSearch">
				<span class="iconfont icon-web"></span>
			</div>
		</el-tooltip>

		<el-tooltip content="温度参数" placement="top">
			<div class="setting-button" size="small" @click="showTemperatureSlider = true">
				<span class="iconfont icon-temperature"></span>
				<span class="value-badge">{{ tabStorage.settings.temperature.toFixed(1) }}</span>
			</div>
		</el-tooltip>

		<el-tooltip content="上下文长度" placement="top">
			<div class="setting-button" size="small" @click="showContextLengthDialog = true">
				<span class="iconfont icon-length"></span>
				<span class="value-badge">{{ tabStorage.settings.contextLength }}</span>
			</div>
		</el-tooltip>

		<!-- 模型选择对话框 -->
		<el-dialog v-model="showModelDialog" title="选择模型" width="400px">
			<el-radio-group v-model="selectedModelIndex"
				@change="onRadioGroupChange"
			>
				<el-radio v-for="(model, index) in availableModels" :key="index" :label="index">
					{{ model }}
				</el-radio>
			</el-radio-group>
			<template #footer>
				<el-button @click="showModelDialog = false">取消</el-button>
				<el-button type="primary" @click="confirmModelChange">确认</el-button>
			</template>
		</el-dialog>

		<!-- System Prompt对话框 -->
		<el-dialog v-model="showSystemPromptDialog" title="系统提示词" width="600px">
			<el-input v-model="tabStorage.settings.systemPrompt" type="textarea" :rows="8"
				placeholder="输入系统提示词（例如：你是一个专业的前端开发助手，用中文回答）" clearable />
			<template #footer>
				<el-button @click="showSystemPromptDialog = false">关闭</el-button>
				<el-button type="primary" @click="showSystemPromptDialog = false">保存</el-button>
			</template>
		</el-dialog>

		<!-- 温度参数滑块 -->
		<el-dialog v-model="showTemperatureSlider" title="设置温度参数" width="400px">
			<div class="slider-container">
				<el-slider v-model="tabStorage.settings.temperature" :min="0" :max="2" :step="0.1" />
				<div class="slider-tips">
					<span>精确(0)</span>
					<span>平衡(1)</span>
					<span>创意(2)</span>
				</div>
			</div>
			<template #footer>
				<el-button @click="showTemperatureSlider = false">关闭</el-button>
			</template>
		</el-dialog>

		<!-- 上下文长度设置 - 改为滑块形式 -->
		<el-dialog v-model="showContextLengthDialog" title="设置上下文长度" width="400px">
			<div class="slider-container">
				<el-slider v-model="tabStorage.settings.contextLength" :min="0" :max="99" :step="1" />
				<div class="slider-tips">
					<span>0: 无上下文</span>
					<span>10: 默认</span>
					<span>99: 最大</span>
				</div>
			</div>
			<template #footer>
				<el-button @click="showContextLengthDialog = false">关闭</el-button>
			</template>
		</el-dialog>


	</div>
</template>

<script setup lang="ts">
import { ref, computed, defineProps } from 'vue';
import { llmManager, llms } from '@/views/setting/llm';
import { tabs } from '../panel';
import { ChatSetting, ChatStorage } from './chat';

const props = defineProps({
	tabId: {
		type: Number,
		required: true
	}
});

const showModelDialog = ref(false);
const showTemperatureSlider = ref(false);
const showContextLengthDialog = ref(false);
const showSystemPromptDialog = ref(false);

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage & { settings: ChatSetting };


if (!tabStorage.settings) {
	tabStorage.settings = {
		modelIndex: llmManager.currentModelIndex,
		enableTools: true,
		enableWebSearch: false,
		temperature: 0.7,
		contextLength: 10,
		systemPrompt: ''
	} as ChatSetting;
}


const selectedModelIndex = ref(llmManager.currentModelIndex);

const availableModels = computed(() => {
	return llms[llmManager.currentModelIndex].models;
});

const hasSystemPrompt = computed(() => {
	return !!tabStorage.settings.systemPrompt?.trim();
});

const toggleTools = () => {
	tabStorage.settings.enableTools = !tabStorage.settings.enableTools;
};

const toggleWebSearch = () => {
	tabStorage.settings.enableWebSearch = !tabStorage.settings.enableWebSearch;
};

const confirmModelChange = () => {
	llmManager.currentModelIndex = selectedModelIndex.value;
	showModelDialog.value = false;
};

const onRadioGroupChange = () => {
	const currentModel = llms[llmManager.currentModelIndex].models[selectedModelIndex.value];
	llms[llmManager.currentModelIndex].userModel = currentModel;
};
</script>

<style scoped>
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

.icon-temperature {
	font-size: 18px;
}

.icon-length {
	font-size: 16px;
}

.slider-tips {
	display: flex;
	justify-content: space-between;
	margin-top: 10px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}
</style>