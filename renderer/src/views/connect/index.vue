<template>
	<el-scrollbar>
		<div class="connection-container">
		<div class="connect-panel-container">
			<ConnectionMethod></ConnectionMethod>
			<ConnectionArgs></ConnectionArgs>
			<EnvVar></EnvVar>

			<div class="connect-action">
				<el-button type="primary" size="large" :loading="isLoading" :disabled="!connectionResult"
					@click="suitableConnect()">
					<span class="iconfont icon-connect" v-if="!isLoading"></span>
					{{ t('connect.appearance.connect') }}
				</el-button>
			</div>
		</div>

		<div class="connect-panel-container">
			<ConnectionLog></ConnectionLog>
		</div>
	</div>
	</el-scrollbar>

</template>

<script setup lang="ts">
import { defineComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

import { connectionResult, doConnect } from './connection';

import ConnectionMethod from './connection-method.vue';
import ConnectionArgs from './connection-args.vue';
import EnvVar from './env-var.vue';

import ConnectionLog from './connection-log.vue';
import { getPlatform } from '@/api/platform';

defineComponent({ name: 'connect' });

const isLoading = ref(false);

async function suitableConnect() {
	isLoading.value = true;

	const plaform = getPlatform();

	await doConnect({ namespace: plaform, updateCommandString: false })

	isLoading.value = false;
}

</script>

<style>
.connection-container {
	display: flex;
}


.connect-panel-container {
	display: flex;
	flex-direction: column;
	width: 45%;
	min-width: 300px;
	padding: 20px;
}

.connection-option {
	display: flex;
	flex-direction: column;
	background-color: var(--background);
	padding: 10px;
	margin-bottom: 20px;
	border-radius: .5em;
	border: 1px solid var(--background);
}

.connection-option>span:first-child {
	margin-bottom: 5px;
}

.input-env-container {
	display: flex;
	margin-bottom: 10px;
}

.display-env {
	padding-top: 10px;
	padding-bottom: 10px;
}

.input-env-container>span {
	width: 150px;
	margin-right: 10px;
	display: flex;
	height: 30px;
	align-items: center;
}

.input-env-container .iconfont {
	font-size: 20px;
	border-radius: 99em;
	color: var(--foreground);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: var(--animation-3s);
	user-select: none;
}

.input-env-container .iconfont:hover {
	color: var(--main-color);
	transition: var(--animation-3s);
}

.connect-action {
	margin-top: 20px;
	padding: 10px;
}
</style>