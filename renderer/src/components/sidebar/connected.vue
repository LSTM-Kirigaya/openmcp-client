<template>
	<div class="connected-status-container"
		@click.stop="toggleConnectionPanel()"
	>
		<span class="mcp-server-info">
			<el-tooltip
				class="extra-connect-container"
				effect="dark"
				placement="right"
				:content="fullDisplayServerName"
			>
				<span class="name">{{ displayServerName }}</span>
			</el-tooltip>
		</span>
		<span class="connect-status">
			<span
				class="status-circle"
				:class="statusColorStyle"
				>
			</span>
			<span class="status-string">{{ statusString }}</span>
		</span>
			
	</div>
</template>

<script setup lang="ts">
import { defineComponent, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Connection } from './sidebar';
import { connectionResult } from '@/views/connect/connection';

defineComponent({ name: 'connected' });

const { t } = useI18n();

const statusString = computed(() => {
	if (connectionResult.success) {
		return t('connected');
	} else {
		return t('disconnected');
	}
});

const statusColorStyle = computed(() => {
	if (connectionResult.success) {
		return 'connected-color';
	} else {
		return 'disconnected-color';
	}
});

const fullDisplayServerName = computed(() => {
	return connectionResult.serverInfo.name + '/' + connectionResult.serverInfo.version;
});

const displayServerName = computed(() => {
	if (connectionResult.serverInfo.name.length > 20) {
		return connectionResult.serverInfo.name.substring(0, 20);
	} else {
		return connectionResult.serverInfo.name;
	}
});

function toggleConnectionPanel() {
	Connection.showPanel = true;
}

</script>

<style>

.connected-color {
	background-color: #21DA49;
}

.disconnected-color {
	background-color: var(--main-color);
}

.status-circle {
	height: 12px;
	width: 12px;
	margin-right: 8px;
	border-radius: 99%;
	box-shadow: 0 0 4px rgba(0, 0, 0, 0.1);
}

.extra-connect-container {
	user-select: none;
}

.connected-status-container {
    user-select: none;
	display: flex;
	align-items: center;
	width: auto;
	padding: 8px 0;
	flex-direction: column;
	border-radius: 6px;
	transition: background-color 0.3s ease;
}

.connected-status-container .connect-status {
	display: flex;
	align-items: center;
	margin-top: 20px;
}

.connected-status-container:hover {
	background-color: var(--sidebar-hover);
}


.status-string {
	color: var(--foreground);
	transition: var(--animation-3s);
	font-size: 13px;
	font-weight: 500;
	white-space: nowrap;
	margin-top: 4px;
}

.mcp-server-info {
	display: flex;
	flex-direction: column;
}

.mcp-server-info .name {
	font-size: 14px;
	font-weight: 600;
	max-width: 60px;
	white-space: wrap;
	background-color: #f39a6d;
	padding: 5px;
	border-radius: .5em;
	color: #1e1e1e;
}

.mcp-server-info .version {
	font-size: 12px;
	font-weight: 400;	
}

</style>