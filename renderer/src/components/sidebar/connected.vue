<template>
	<div class="connected-status-container"
		@click.stop="toggleConnectionPanel()"
	>
		<span
			class="status-circle"
			:class="statusColorStyle"
			>
		</span>
		<span class="status-string">{{ statusString }}</span>
			
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
	margin-right: 10px;
	border-radius: 99%;
}

.extra-connect-container {
	cursor: pointer;
	user-select: none;
}

.connected-status-container {
    user-select: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	width: 100%;
	justify-content: center;
}

.connected-status-container:hover .status-string {
	color: var(--main-color);
	transition: var(--animation-3s);
}

</style>