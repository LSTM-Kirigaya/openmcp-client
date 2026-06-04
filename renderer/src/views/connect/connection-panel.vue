<template>
	<div class="connection-panel-wrapper" @dragover.prevent="handleDragOver" @drop.prevent="handleDrop">
		<div v-if="isDraging" class="drag-mask">
			<span class="iconfont icon-connect"></span>
			<span>{{ t('drag-to-fill-connect-parameters') }}</span>
		</div>
		<el-splitter layout="vertical" class="connection-panel-splitter">
			<el-splitter-panel :min="200" class="splitter-options-panel">
				<div class="connect-panel-container top" :ref="el => client.connectionSettingRef = el">
					<el-scrollbar class="options-scrollbar">
						<div class="connection-setting-content">
							<ConnectionMethodAndArgs
								:index="props.index"
								:loading="isLoading"
								:disconnecting="isDisconnecting"
								@connect="connect"
								@disconnect="disconnect"
							/>
							<div v-if="client.connectionArgs.connectionType === 'STDIO'" class="setting-section connection-env-section">
								<h2>{{ t('env-var') }}</h2>
								<ConnectionEnvironment :index="props.index" />
							</div>
						</div>
					</el-scrollbar>
				</div>
			</el-splitter-panel>
			<el-splitter-panel
				class="splitter-log-panel"
				:class="{ collapsed: isLogCollapsed }"
				:size="logPanelSize"
				:min="collapsedLogPanelSize"
				:max="520"
				@update:size="handleLogPanelSizeUpdate"
			>
				<div class="connect-panel-container bottom" :ref="el => client.connectionLogRef = el">
					<ConnectionLog
						:index="props.index"
						:collapsed="isLogCollapsed"
						@toggle-collapse="toggleLogCollapsed"
					/>
				</div>
			</el-splitter-panel>
		</el-splitter>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ConnectionMethodAndArgs from './connection-method-and-args.vue';
import ConnectionEnvironment from './connection-environment.vue';
import ConnectionLog from './connection-log.vue';

import { mcpClientAdapter } from './core';

defineComponent({ name: 'connection-panel' });

const props = defineProps({
	index: {
		type: Number,
		required: true
	}
});

const client = computed(() => mcpClientAdapter.clients[props.index]);

const { t } = useI18n();

const isLoading = ref(false);
const isDisconnecting = ref(false);
const collapsedLogPanelSize = 58;
const minExpandedLogPanelSize = 96;
const defaultExpandedLogPanelSize = 260;
const logPanelSize = ref<string | number>(collapsedLogPanelSize);
const lastExpandedLogPanelSize = ref<string | number>(defaultExpandedLogPanelSize);
const isLogCollapsed = ref(true);

function getPixelSize(size: string | number) {
	if (typeof size === 'number') return size;
	if (size.endsWith('px')) return Number(size.slice(0, -2));
	const parsed = Number(size);
	return Number.isNaN(parsed) ? null : parsed;
}

function handleLogPanelSizeUpdate(size: string | number) {
	logPanelSize.value = size;
	const pixelSize = getPixelSize(size);
	if (pixelSize === null) return;
	if (pixelSize <= collapsedLogPanelSize + 4) {
		isLogCollapsed.value = true;
		return;
	}
	lastExpandedLogPanelSize.value = size;
	isLogCollapsed.value = false;
}

function toggleLogCollapsed() {
	if (isLogCollapsed.value) {
		isLogCollapsed.value = false;
		logPanelSize.value = lastExpandedLogPanelSize.value || defaultExpandedLogPanelSize;
		return;
	}
	if ((getPixelSize(logPanelSize.value) || 0) >= minExpandedLogPanelSize) {
		lastExpandedLogPanelSize.value = logPanelSize.value;
	}
	isLogCollapsed.value = true;
	logPanelSize.value = collapsedLogPanelSize;
}

async function connect() {
	isLoading.value = true;
	// 点击连接时自动展开日志面板，方便用户实时查看连接过程
	if (isLogCollapsed.value) {
		toggleLogCollapsed();
	}
	const ok = await client.value.connect();
	if (ok) {
		mcpClientAdapter.saveLaunchSignature();
		await mcpClientAdapter.loadPanels();
	}
	isLoading.value = false;
}

async function disconnect() {
	isDisconnecting.value = true;
	try {
		await client.value.disconnect();
	} catch (error) {
		console.error('Disconnect error:', error);
	} finally {
		isDisconnecting.value = false;
	}
}

const isDraging = ref(false);
let dragHandler: NodeJS.Timeout;

function handleDragOver(event: DragEvent) {
	event.preventDefault();
	clearTimeout(dragHandler);
	isDraging.value = true;
	dragHandler = setTimeout(() => { isDraging.value = false; }, 100);
}

function getLaunchCommand(fileName: string) {
	const ext = fileName.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'py': return `mcp run ${fileName}`;
		case 'js': return `node ${fileName}`;
		default: return fileName;
	}
}

function handleDrop(event: DragEvent) {
	event.preventDefault();
	const dragedFilePath = event.dataTransfer?.getData('text/plain') || '';
	if (dragedFilePath) {
		const path = dragedFilePath.replace(/\\/g, '/');
		const coms = path.split('/');
		const fileName = coms[coms.length - 1];
		const cwd = coms.slice(0, coms.length - 1).join('/');
		const command = getLaunchCommand(fileName);
		client.value.connectionArgs.connectionType = 'STDIO';
		client.value.connectionArgs.commandString = command;
		client.value.connectionArgs.cwd = cwd;
	}
	isDraging.value = false;
}
</script>

<style scoped>
.connection-panel-wrapper {
	position: relative;
	height: 100%;
	min-height: 0;
}

.connection-panel-splitter {
	height: 100%;
	width: 100%;
}

.connection-panel-splitter :deep(.el-splitter__panel) {
	overflow: hidden;
}

.connection-panel-splitter :deep(.el-splitter-bar) {
	z-index: 2;
}

.connection-panel-splitter :deep(.el-splitter-bar__dragger-vertical)::before {
	height: 3px;
	background-color: var(--el-border-color);
	transition: background-color var(--el-transition-duration-fast), height var(--el-transition-duration-fast);
}

.connection-panel-splitter :deep(.el-splitter-bar__dragger-vertical:hover)::before,
.connection-panel-splitter :deep(.el-splitter-bar__dragger-active)::before {
	height: 4px;
	background-color: var(--main-light-color-60);
}

.splitter-options-panel {
	display: flex;
	flex-direction: column;
}

.connect-panel-container.top {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-width: 0;
}

.connect-panel-container.top .options-scrollbar {
	flex: 1;
	min-height: 0;
}

.connect-panel-container.bottom {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-width: 0;
	overflow: hidden;
}

.drag-mask {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.5);
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	color: white;
	font-size: 18px;
	z-index: 9999;
}

.drag-mask .iconfont {
	font-size: 80px;
	margin-bottom: 20px;
}
</style>
