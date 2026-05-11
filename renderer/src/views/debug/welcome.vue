<template>
	<div class="debug-welcome">
		<span>{{ t('choose-a-project-debug') }}</span>
		
        <br>

		<!-- MCP Base 模块 -->
		<div class="welcome-container base-module"
			:ref="el => welcomeRef = el"
		>
			<span
				class="debug-option"
				:class="{ 'disable': !mcpClientAdapter.connected }"
				v-for="(option, index) of baseOptions"
				:key="index"
				@click="chooseDebugMode(index)"
			>
				<span>
					<span :class="`iconfont ${option.icon}`"></span>
				</span>
				<span>{{ option.name }}</span>
			</span>
		</div>
        <br>
		
		<!-- MCP Advance 模块 -->
		<div class="welcome-container advance-module"
			:ref="el => welcomeRef = el"
		>
			<span
				class="debug-option"
				v-for="(option, index) of advanceOptions"
				:key="index"
				@click="chooseDebugMode(index + baseOptions.length)"
			>
				<span>
					<span :class="`iconfont ${option.icon}`"></span>
				</span>
				<span>{{ option.name }}</span>
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { tabs } from '@/components/main-panel/panel';
import { defineComponent, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { welcomeRef } from './welcome';
import { mcpClientAdapter } from '../connect/core';

defineComponent({ name: 'welcome' });

const { t } = useI18n();

// MCP Base 模块 - resources, prompts, tools
const baseOptions = [
	{
		icon: 'icon-file',
		name: computed(() => t("resources")),
		ident: 'resources'
	},
	{
		icon: 'icon-chat',
		name: computed(() => t("prompts")),
		ident: 'prompts'
	},
	{
		icon: 'icon-tool',
		name: computed(() => t("tools")),
		ident: 'tool'
	}
];

// MCP Advance 模块 - interaction-test, lookup-reflux-data, batch-validation
const advanceOptions = [
	{
		icon: 'icon-robot',
		name: computed(() => t("interaction-test")),
		ident: 'interaction'
	},
	{
		icon: 'icon-database',
		name: computed(() => t('lookup-reflux-data')),
		ident: 'reflux'
	},
	{
		icon: 'icon-dui',
		name: computed(() => t('batch-validation')),
		ident: 'batch-validation'
	}
];

function chooseDebugMode(index: number) {
	// TODO: 支持更多的 server
	const isBase = index < baseOptions.length;
	if (isBase && !mcpClientAdapter.connected) {
		const message = t('warning.click-to-connect')
			.replace('$1', t('connect'));
		
		ElMessage({
			message,
			type: 'error',
			duration: 3000,
			showClose: true,
		});
		return;
	}

	const activeTab = tabs.activeTab;
	activeTab.componentIndex = index;
	// 根据索引确定使用哪个选项数组中的图标
	if (index < baseOptions.length) {
		activeTab.icon = baseOptions[index].icon;
		activeTab.name = baseOptions[index].name as any;
	} else {
		activeTab.icon = advanceOptions[index - baseOptions.length].icon;
		activeTab.name = advanceOptions[index - baseOptions.length].name as any;
	}

	// 此处可以这么做是因为这个操作过后 activeTab 绑定的 tab 的 name 就不会再被进行赋值操作了
	// console.log(debugOptions[index]);

	console.log(tabs);
}

</script>

<style>
.debug-welcome {
	display: flex;
	flex-direction: column;
	align-items: center; /* 左对齐 */
	justify-content: center;
	width: 100%;
	padding: 0 50px; /* 添加内边距 */
	box-sizing: border-box;
}

.debug-welcome > span {
	font-size: 24px;
	margin: 30px 0;
	color: var(--foreground);
}

.module-title {
	font-size: 24px;
	font-weight: bold;
	margin: 30px 0 20px 0; /* 调整标题边距 */
	width: 100%;
	text-align: left; /* 标题左对齐 */
}

.welcome-container {
	/* 统一使用 Grid 实现栅格与间距 */
	--gap: 16px;
	--card-min: 180px;
	display: grid;
	gap: var(--gap);
	width: 100%;
}

.base-module {
	/* 上方 3 列，整体块居中 */
	grid-template-columns: repeat(3, minmax(var(--card-min), 1fr));
	max-width: calc(3 * var(--card-min) + 2 * var(--gap));
	margin: 0 auto;
}

.advance-module {
	/* 下方 3 列，整体块居中 */
	grid-template-columns: repeat(3, minmax(var(--card-min), 1fr));
	max-width: calc(3 * var(--card-min) + 2 * var(--gap));
	margin: 0 auto;
}

/* 去除基于 Flex 的宽度规则，改由 Grid 控制列与间距 */

.welcome-container > span {
	box-sizing: border-box;
	transition: .3s transform ease-in-out;
}

.debug-option {
	display: flex;
	flex-direction: column;
	align-items: center;
	font-size: 14px;
	padding: 18px 16px;
	border-radius: 12px;
	cursor: pointer;
	border: 1px solid var(--sidebar-border);
	transition: var(--animation-3s);
	height: 100%;
	min-height: 112px;
	justify-content: center;
	text-align: center;
	background-color: var(--sidebar);
	color: var(--foreground);
}

.debug-option > span:first-child {
	margin-bottom: 8px;
}

.debug-option:hover {
	border-color: var(--main-color);
	transition: var(--animation-3s);
}

.debug-option .iconfont {
	font-size: 34px;
}

.debug-welcome {
	user-select: none;
	min-height: 80%;
}

.debug-option.disable {
	cursor: not-allowed;
	opacity: 0.5;
}

/* 响应式设计 */
@media (max-width: 1200px) {
	/* 窄屏时上方退化为 2 列并保持居中 */
	.base-module {
		grid-template-columns: repeat(2, minmax(var(--card-min), 1fr));
		max-width: calc(2 * var(--card-min) + 1 * var(--gap));
	}

	/* 下方 3 列退化为 2 列 */
	.advance-module {
		grid-template-columns: repeat(2, minmax(var(--card-min), 1fr));
		max-width: calc(2 * var(--card-min) + 1 * var(--gap));
	}

	.debug-option {
		font-size: 14px;
		min-height: 112px;
	}
}

@media (max-width: 768px) {
	.debug-welcome {
		padding: 0 20px; /* 移动端减小内边距 */
	}
	
	/* 移动端均退化为 1 列并居中 */
	.base-module,
	.advance-module {
		grid-template-columns: 1fr;
		max-width: var(--card-min);
		gap: 14px;
	}
	
	.debug-option {
		font-size: 14px;
		min-height: 108px;
	}
	
	.debug-option .iconfont {
		font-size: 32px;
	}
	
	.module-title {
		font-size: 20px;
	}
}
</style>
