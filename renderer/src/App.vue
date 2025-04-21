<template>
	<div class="main">
		<Sidebar></Sidebar>
		<MainPanel></MainPanel>
	</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Connection } from './components/sidebar/sidebar';

import Sidebar from '@/components/sidebar/index.vue';
import MainPanel from '@/components/main-panel/index.vue';
import { setDefaultCss } from './hook/css';
import { greenLog, pinkLog } from './views/setting/util';
import { acquireVsCodeApi, useMessageBridge } from './api/message-bridge';
import { connectionArgs, connectionMethods, connectionResult, doConnect, getServerVersion, launchConnect } from './views/connect/connection';
import { loadSetting } from './hook/setting';
import { loadPanels } from './hook/panel';

const bridge = useMessageBridge();

// 监听所有消息
bridge.addCommandListener('hello', data => {
	greenLog(`${data.name}`);
	greenLog(`version: ${data.version}`);
}, { once: true });


function initDebug() {
	connectionArgs.commandString = 'uv run mcp run ../servers/bing-picture.py';
	connectionMethods.current = 'STDIO';

	setTimeout(async () => {
		// 初始化 设置
		loadSetting();

		// 尝试连接
		await doConnect();

		// 初始化 tab
		loadPanels();

	}, 200);
}

const route = useRoute();
const router = useRouter();

async function initProduce() {
	// TODO: get from vscode
	connectionArgs.commandString = 'mcp run ../servers/main.py';
	connectionMethods.current = 'STDIO';

	// 初始化 设置
	loadSetting();

	// 尝试连接
	await launchConnect();

	// 初始化 tab
	await loadPanels();
	
	if (route.name !== 'debug') {
		router.replace('/debug');
		router.push('/debug');
	}
}

onMounted(() => {
	// 初始化 css
	setDefaultCss();

	document.addEventListener('click', () => {
		Connection.showPanel = false;
	});

	pinkLog('OpenMCP Client 启动');

	if (acquireVsCodeApi === undefined) {
		initDebug();
	} else {
		initProduce();
	}
});

</script>

<style>
.main {
	height: calc(100vh - 50px);
	display: flex;
	justify-content: center;
}

.message-text img {
    max-width: 98%;
}

</style>
