<template>
	<div class="connection-container">
		<div class="connect-panel-container">
			<ConnectionMethod></ConnectionMethod>
			<ConnectionArgs></ConnectionArgs>
			<EnvVar></EnvVar>

			<div class="connect-action">
				<el-button
					type="primary"
					size="large"
					:disabled="!connectionResult"
					@click="suitableConnect()"
				>
					{{ t('connect.appearance.connect') }}
				</el-button>

				<el-button
					type="primary"
					size="large"
					@click="doReconnect()"
				>
				{{ t('connect.appearance.reconnect') }}
				</el-button>
			</div>
		</div>

		<div class="connect-panel-container">
			<ConnectionLog></ConnectionLog>
		</div>
	</div>

</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

import { connectionResult, doConnect, doReconnect, launchConnect } from './connection';

import ConnectionMethod from './connection-method.vue';
import ConnectionArgs from './connection-args.vue';
import EnvVar from './env-var.vue';

import ConnectionLog from './connection-log.vue';

import { acquireVsCodeApi, useMessageBridge } from '@/api/message-bridge';

defineComponent({ name: 'connect' });

const bridge = useMessageBridge();

bridge.addCommandListener('connect', data => {
	const { code, msg } = data;
	connectionResult.success = (code === 200);
	connectionResult.logString = msg;
}, { once: false });

function suitableConnect() {
	if (acquireVsCodeApi === undefined) {
		doConnect();
	} else {
		launchConnect({ updateCommandString: false });
	}
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

.input-env-container > span {
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