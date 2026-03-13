<template>
	<el-tooltip :content="tooltipContent" placement="right" effect="light">
		<div
			class="connection-status"
			id="connected-status-container"
			:class="statusClass"
			@click.stop="toggleConnectionPanel()"
		>
			<span class="status-indicator">
				<span v-if="isConnecting" class="status-loading"></span>
				<span v-else class="status-dot" :class="client.connectionResult.success ? 'connected' : 'disconnected'"></span>
			</span>
			<span class="server-name">{{ displayText }}</span>
		</div>
	</el-tooltip>
</template>

<script setup lang="ts">
import { defineComponent, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Connection } from './sidebar';
import { mcpClientAdapter } from '@/views/connect/core';
import { isConnecting } from './connected';
defineComponent({ name: 'connected' });

const { t } = useI18n();
const client = computed(() => mcpClientAdapter.masterNode);

const displayText = computed(() => {
	if (isConnecting.value) return t("loading");
	return displayServerName.value;
});

const displayServerName = computed(() => {
	const name = client.value.connectionResult.name;
	if (!name) return '—';
	if (name.length <= 3) return name.toUpperCase();

	// 处理中文混合名称
	const chineseMatch = name.match(/[\u4e00-\u9fa5]/g);
	if (chineseMatch && chineseMatch.length >= 2) {
		return chineseMatch.slice(0, 3).join('');
	}

	// 处理各种命名格式：驼峰、空格、连字符、下划线
	const words = name
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.split(/[\s\-_]+/)
		.filter(word => word.length > 0);

	if (words.length === 1 && words[0].length > 3) {
		return words[0].substring(0, 3).toUpperCase();
	}

	return words
		.map(word => word[0].toUpperCase())
		.slice(0, 3)
		.join('');
});

const tooltipContent = computed(() => {
	if (isConnecting.value) return t("loading");
	const { name, version } = client.value.connectionResult;
	return name ? `${name}${version ? ' / ' + version : ''}` : t("disconnected");
});

const statusClass = computed(() => ({
	'connecting': isConnecting.value,
	'connected': !isConnecting.value && client.value.connectionResult.success,
	'disconnected': !isConnecting.value && !client.value.connectionResult.success,
}));

function toggleConnectionPanel() {
	Connection.showPanel = true;
}
</script>

<style scoped>
.connection-status {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	width: calc(100% - 16px);
	margin: 8px;
	padding: 6px 4px;
	border-radius: 10px;
	background-color: var(--main-light-color-10);
	border: 1px solid var(--main-light-color-20);
	cursor: pointer;
	user-select: none;
	transition: var(--animation-3s);
	box-sizing: border-box;
}

.connection-status:hover {
	background-color: var(--sidebar-item-hover);
	border-color: var(--main-light-color-40);
}

.connection-status.disconnected {
	opacity: 0.85;
}

.status-indicator {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.status-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	transition: var(--animation-3s);
}

.status-dot.connected {
	background-color: var(--main-color);
	box-shadow: 0 0 0 3px var(--main-light-color-20);
}

.status-dot.disconnected {
	background-color: var(--sidebar-item-text);
	opacity: 0.7;
}

.status-loading {
	width: 10px;
	height: 10px;
	border: 2px solid var(--sidebar-item-text);
	border-top-color: var(--main-color);
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}

.server-name {
	width: 100%;
	text-align: center;
	font-size: var(--vscode-font-size, 10px);
	font-weight: 600;
	color: var(--sidebar-item-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	transition: var(--animation-3s);
}

.connection-status:hover .server-name,
.connection-status.connected .server-name {
	color: var(--foreground);
}

@keyframes spin {
	to { transform: rotate(360deg); }
}
</style>
