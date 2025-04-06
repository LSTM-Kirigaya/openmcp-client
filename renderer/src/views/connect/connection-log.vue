<template>
	<div class="connection-option">
		<span>{{ t('log') }}</span>
		<el-scrollbar height="300px">
			<div
				class="output-content"
				contenteditable="false"
			>
				{{ connectionResult.logString }}
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
.connection-option .output-content {
	border-radius: .5em;
	padding: 15px;
	min-height: 300px;
	height: fit-content;
	font-family: var(--code-font-family);
	white-space: pre-wrap;
	word-break: break-all;
	user-select: text;
	cursor: text;
	font-size: 15px;
	line-height: 1.5;
	background-color: var(--sidebar);
}
</style>