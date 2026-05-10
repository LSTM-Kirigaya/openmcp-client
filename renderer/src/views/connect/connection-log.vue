<template>
	<div class="connection-log-wrap">
		<div class="connection-log-header">
			<span class="connection-log-header-title">{{ t('log') }}</span>
			<span class="iconfont icon-delete connection-log-clear" @click="clearLogs" :title="t('clear')"></span>
			<el-button-group class="connection-actions-group">
				<el-button
					class="btn-disconnect"
					:loading="disconnecting"
					:disabled="!connected"
					@click="$emit('disconnect')"
				>
					{{ t('connection-log-disconnect') }}
				</el-button>
				<el-button
					type="primary"
					class="btn-connect"
					:loading="loading"
					@click="$emit('connect')"
				>
					{{ t('connection-log-connect') }}
				</el-button>
			</el-button-group>
		</div>
		<el-scrollbar class="connection-log-scroll">
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
import { mcpClientAdapter } from './core';

defineComponent({ name: 'connection-log' });

const props = defineProps({
	index: { type: Number, required: true },
	loading: { type: Boolean, default: false },
	disconnecting: { type: Boolean, default: false },
	connected: { type: Boolean, default: false },
});

defineEmits<{
	(e: 'connect'): void;
	(e: 'disconnect'): void;
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
	padding: 12px 16px;
	font-weight: 600;
	font-size: 15px;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}

.connection-log-header-title {
	flex-shrink: 0;
}

.connection-log-clear {
	cursor: pointer;
	color: var(--el-text-color-secondary);
	font-size: 16px;
	margin-left: auto;
}
.connection-log-clear:hover {
	color: var(--el-color-error);
}

.connection-log-scroll {
	flex: 1;
	min-height: 0;
}

/* 仿工具测试 executor-actions-group：断开在左、连接在右 */
.connection-actions-group {
	display: inline-flex;
}

.connection-actions-group .el-button {
	border-radius: 0 !important;
	border-color: var(--window-button-active) !important;
	border-top: 1px solid var(--window-button-active);
	border-left: 1px solid var(--window-button-active);
	border-bottom: 1px solid var(--window-button-active);
	border-right: 1px solid var(--window-button-active);
	background-color: var(--el-fill-color-blank);
	color: var(--el-text-color-regular);
	padding: 8px 18px;
	font-size: 14px;
	transition: var(--animation-3s);
}

.connection-actions-group .el-button:first-child {
	border-top-left-radius: 8px !important;
	border-bottom-left-radius: 8px !important;
}

.connection-actions-group .el-button:last-child {
	border: 1px solid var(--main-light-color-50) !important;
	border-top-right-radius: 8px !important;
	border-bottom-right-radius: 8px !important;
}

.connection-actions-group .btn-disconnect:hover:not(:disabled) {
	border-color: var(--el-border-color-hover);
	background-color: var(--main-light-color-50);
	color: var(--el-text-color-primary);
}

.connection-actions-group .btn-disconnect:disabled {
	opacity: 0.5;
}

.connection-actions-group .btn-connect {
	background-color: var(--main-light-color-20) !important;
	color: var(--el-text-color-primary) !important;
	border-color: var(--main-light-color-50) !important;
	font-weight: 600;
}

.connection-actions-group .btn-connect:hover:not(:disabled),
.connection-actions-group .btn-connect:focus {
	background-color: var(--main-light-color-50) !important;
	color: var(--el-text-color-primary) !important;
	border-color: var(--main-light-color-90) !important;
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
