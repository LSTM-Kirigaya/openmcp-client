<template>
	<div class="connection-log-wrap">
		<div class="connection-log-header" :class="{ collapsed }">
			<button
				type="button"
				class="connection-log-toggle"
				:class="{ collapsed }"
				:title="collapsed ? t('expand') : t('collapse')"
				:aria-label="collapsed ? t('expand') : t('collapse')"
				@click="$emit('toggle-collapse')"
			>
				<el-icon><ArrowDown /></el-icon>
			</button>
			<span class="connection-log-header-title">{{ t('log') }}</span>
			<span
				v-if="!collapsed"
				class="iconfont icon-delete connection-log-clear"
				@click="clearLogs"
				:title="t('clear')"
			></span>
		</div>
		<el-scrollbar v-if="!collapsed" class="connection-log-scroll">
			<div class="output-content">
				<el-collapse :expand-icon-position="'left'">
					<el-collapse-item v-for="(log, index) in logString" :name="index" :class="['item', log.type]">
						<template #title>
							<div class="tool-calls">
								<div class="tool-call-header">
									<span>{{ log.title }}</span>
								</div>
							</div>
						</template>
						<div class="logger-inner">
							{{ log.message || '' }}
						</div>
					</el-collapse-item>
				</el-collapse>
			</div>
		</el-scrollbar>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowDown } from '@element-plus/icons-vue';
import { mcpClientAdapter } from './core';

defineComponent({ name: 'connection-log' });

const props = defineProps({
	index: { type: Number, required: true },
	collapsed: { type: Boolean, default: false },
});

defineEmits<{
	(e: 'toggle-collapse'): void;
}>();

const logString = computed(() => {
	return mcpClientAdapter.clients[props.index].connectionResult.logString;
});

const { t } = useI18n();

function clearLogs() {
	mcpClientAdapter.clients[props.index].connectionResult.logString = [];
}
</script>

<style scoped>
/* 与批量测试 batch-results 完全一致的结构与样式 */
.connection-log-wrap {
	height: 100%;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.connection-log-header {
	padding: 10px 16px;
	font-weight: 600;
	font-size: 15px;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	gap: 10px;
	min-height: 58px;
	box-sizing: border-box;
	border-bottom: 1px solid var(--el-border-color-lighter);
	background-color: var(--el-bg-color);
}

.connection-log-header.collapsed {
	border-bottom: 0;
}

.connection-log-header-title {
	flex-shrink: 0;
	margin-right: auto;
}

.connection-log-toggle {
	width: 28px;
	height: 28px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	background-color: var(--el-fill-color-blank);
	color: var(--el-text-color-secondary);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	cursor: pointer;
	transition: var(--animation-3s);
	flex-shrink: 0;
}

.connection-log-toggle:hover {
	color: var(--el-text-color-primary);
	border-color: var(--main-light-color-60);
	background-color: var(--main-light-color-20);
}

.connection-log-toggle .el-icon {
	font-size: 15px;
	transform: rotate(180deg);
	transition: transform var(--el-transition-duration-fast);
}

.connection-log-toggle.collapsed .el-icon {
	transform: rotate(0deg);
}

.connection-log-clear {
	cursor: pointer;
	color: var(--el-text-color-secondary);
	font-size: 16px;
}
.connection-log-clear:hover {
	color: var(--el-color-error);
}

.connection-log-scroll {
	flex: 1;
	min-height: 0;
}

.connection-log-wrap :deep(.output-content) {
	padding: 16px;
	font-family: var(--code-font-family);
	white-space: pre-wrap;
	word-break: break-all;
	user-select: text;
	cursor: text;
	font-size: 14px;
	line-height: 1.6;
}

.connection-log-wrap :deep(.output-content .item) {
	margin-bottom: 12px;
	padding: 0px 9px;
	border-radius: 0.5em;
	border: 1px solid var(--window-button-active);
}

.connection-log-wrap :deep(.output-content .error) {
	background-color: rgba(245, 108, 108, 0.5);
}

.connection-log-wrap :deep(.output-content .warning) {
	background-color: rgba(230, 162, 60, 0.5);
}

.connection-log-wrap :deep(.output-content .el-collapse-item__header),
.connection-log-wrap :deep(.output-content .el-collapse-item__wrap) {
	background-color: unset !important;
	border-bottom: unset !important;
}

.connection-log-wrap :deep(.output-content .el-collapse-item__content) {
	padding-bottom: unset;
}

.connection-log-wrap :deep(.logger-inner) {
	padding: 10px;
}
</style>
