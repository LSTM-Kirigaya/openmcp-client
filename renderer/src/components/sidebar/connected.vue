<template>
	<el-popover
		:visible="popoverVisible"
		placement="right-start"
		:width="220"
		trigger="click"
		:offset="8"
		:show-arrow="false"
		popper-class="status-popover"
		@click.stop
	>
		<template #reference>
			<div
				class="connection-status"
				id="connected-status-container"
				:class="statusClass"
				@click.stop="popoverVisible = !popoverVisible"
			>
				<span class="status-indicator">
					<span v-if="isConnecting" class="status-loading"></span>
					<span v-else class="status-dot" :class="client.connectionResult.success ? 'connected' : 'disconnected'"></span>
				</span>
				<span class="server-name">{{ displayText }}</span>
			</div>
		</template>

		<div class="popover-content">
			<div class="popover-header">
				<span class="popover-title">{{ t('sidebar-mcp-hub') }}</span>
				<span v-if="serverName" class="popover-subtitle">{{ serverName }}{{ serverVersion ? ' / ' + serverVersion : '' }}</span>
				<span v-else class="popover-subtitle muted">{{ t('disconnected') }}</span>
			</div>

			<div class="popover-divider"></div>

			<div class="popover-section">
				<span class="section-label">{{ t('theme-label') }}</span>
				<div class="theme-toggle-group">
					<button
						class="theme-btn"
						:class="{ active: themeMode === 'light' }"
						@click="setTheme('light')"
					>{{ t('theme-light') }}</button>
					<button
						class="theme-btn"
						:class="{ active: themeMode === 'dark' }"
						@click="setTheme('dark')"
					>{{ t('theme-dark') }}</button>
					<button
						class="theme-btn"
						:class="{ active: themeMode === 'system' }"
						@click="setTheme('system')"
					>{{ t('theme-system') }}</button>
				</div>
			</div>

			<div class="popover-divider"></div>

			<div class="popover-links">
				<a
					class="popover-link"
					href="https://github.com/LSTM-Kirigaya/openmcp-client"
					target="_blank"
					rel="noopener noreferrer"
				>
					<span class="iconfont icon-github"></span>
					<span>{{ t('sidebar-github') }}</span>
				</a>
				<a
					class="popover-link"
					href="https://openmcp.kirigaya.cn"
					target="_blank"
					rel="noopener noreferrer"
				>
					<span class="iconfont icon-wendang"></span>
					<span>{{ t('openmcp-document') }}</span>
				</a>
			</div>
		</div>
	</el-popover>
</template>

<script setup lang="ts">
import { defineComponent, computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mcpClientAdapter } from '@/views/connect/core';
import { isConnecting } from './connected';
import { themeMode, setTheme } from '@/hook/theme';

defineComponent({ name: 'connected' });

const { t } = useI18n();
const client = computed(() => mcpClientAdapter.masterNode);
const popoverVisible = ref(false);

const serverName = computed(() => {
	const name = client.value.connectionResult.name;
	return name || '';
});

const serverVersion = computed(() => {
	return client.value.connectionResult.version || '';
});

const displayText = computed(() => {
	if (isConnecting.value) return '...';
	return displayServerName.value;
});

const displayServerName = computed(() => {
	const name = client.value.connectionResult.name;
	if (!name) return '—';
	if (name.length <= 3) return name.toUpperCase();

	const chineseMatch = name.match(/[一-龥]/g);
	if (chineseMatch && chineseMatch.length >= 2) {
		return chineseMatch.slice(0, 3).join('');
	}

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

const statusClass = computed(() => ({
	'connecting': isConnecting.value,
	'connected': !isConnecting.value && client.value.connectionResult.success,
	'disconnected': !isConnecting.value && !client.value.connectionResult.success,
}));
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

<style>
.status-popover {
	padding: 12px 0 !important;
	border-radius: 12px !important;
	background-color: var(--sidebar) !important;
	border: 1px solid var(--border) !important;
}

.popover-content {
	display: flex;
	flex-direction: column;
}

.popover-header {
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 0 16px 8px;
}

.popover-title {
	font-size: 13px;
	font-weight: 700;
	color: var(--foreground);
}

.popover-subtitle {
	font-size: 11px;
	color: var(--foreground-muted);
}

.popover-subtitle.muted {
	opacity: 0.6;
}

.popover-divider {
	height: 1px;
	margin: 4px 12px;
	background-color: var(--border);
}

.popover-section {
	padding: 8px 16px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.section-label {
	font-size: 11px;
	font-weight: 600;
	color: var(--sidebar-group-text);
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

.theme-toggle-group {
	display: flex;
	gap: 4px;
	background-color: var(--sidebar-item-selected);
	border-radius: 8px;
	padding: 3px;
}

.theme-btn {
	flex: 1;
	padding: 5px 0;
	border: none;
	border-radius: 6px;
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
	background: transparent;
	color: var(--sidebar-item-text);
	transition: var(--animation-3s);
}

.theme-btn:hover {
	color: var(--foreground);
}

.theme-btn.active {
	background-color: var(--main-color);
	color: #ffffff;
}

.popover-links {
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 4px 8px;
}

.popover-link {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 8px;
	border-radius: 8px;
	text-decoration: none;
	color: var(--sidebar-item-text);
	font-size: 12px;
	font-weight: 500;
	transition: var(--animation-3s);
}

.popover-link:hover {
	background-color: var(--sidebar-item-hover);
	color: var(--foreground);
}

.popover-link .iconfont {
	font-size: 16px;
	width: 18px;
	text-align: center;
}
</style>
