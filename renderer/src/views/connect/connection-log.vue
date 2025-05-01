<template>
	<div class="connection-option">
		<span>{{ t('log') }}</span>
		<el-scrollbar height="90%">
			<div class="output-content">
				<div v-for="(log, index) in connectionResult.logString" :key="index" :class="log.type">
					<span class="log-message">{{ log.message }}</span>
				</div>
			</div>
		</el-scrollbar>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { connectionResult } from './connection';

defineComponent({ name: 'connection-log' });

const { t } = useI18n();

</script>

<style>
.connection-option {
	height: 90%;
}

.connection-option .el-scrollbar__view {
	height: 100%;
}

.connection-option .output-content {
	border-radius: .5em;
	padding: 12px 16px;
	min-height: 300px;
	height: fit-content;
	font-family: var(--code-font-family);
	white-space: pre-wrap;
	word-break: break-all;
	user-select: text;
	cursor: text;
	font-size: 14px;
	line-height: 1.6;
	background-color: rgba(var(--sidebar), 0.3);
	height: 95%;
}

.output-content .info {
	background-color: rgba(103, 194, 58, 0.5);
	margin: 8px 0;
	margin-bottom: 12px;
	padding: 5px 9px;
	border-radius: .5em;
}

.output-content .error {
	background-color: rgba(245, 108, 108, 0.5);
	margin: 8px 0;
	margin-bottom: 12px;
	padding: 5px 9px;
	border-radius: .5em;
}

.output-content .warning {
	background-color: rgba(230, 162, 60, 0.5);
	margin: 8px 0;
	margin-bottom: 12px;
	padding: 5px 9px;
	border-radius: .5em;
}

.log-icon {
	display: inline-block;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	margin-right: 8px;
	vertical-align: middle;
}

.log-icon.info {
	background-color: rgba(103, 194, 58, 0.3);
}

.log-icon.error {
	background-color: rgba(245, 108, 108, 0.3);
}

.log-icon.warning {
	background-color: rgba(230, 162, 60, 0.3);
}

.log-message {
	display: inline-block;
	vertical-align: middle;
}
</style>