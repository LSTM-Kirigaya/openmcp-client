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
import { useMessageBridge } from './api/message-bridge';
import { connectionArgs, connectionMethods, doConnect, loadEnvVar } from './views/connect/connection';
import { loadSetting } from './hook/setting';
import { loadPanels } from './hook/panel';
import { getPlatform } from './api/platform';

const bridge = useMessageBridge();

// 监听所有消息
bridge.addCommandListener('hello', data => {
	greenLog(`${data.name}`);
	greenLog(`version: ${data.version}`);
}, { once: true });


const route = useRoute();
const router = useRouter();

onMounted(async () => {
	// 初始化 css
	setDefaultCss();

	document.addEventListener('click', () => {
		Connection.showPanel = false;
	});

	pinkLog('OpenMCP Client 启动');

	const platform = getPlatform();

	// 跳转到首页
	if (platform !== 'web') {
		if (route.name !== 'debug') {
			router.replace('/debug');
			router.push('/debug');
		}
	}

	// 进行桥接
	await bridge.awaitForWebsockt();

	pinkLog('准备请求设置');

	// 加载全局设置
	loadSetting();

	// 设置环境变量
	loadEnvVar();

	// 尝试进行初始化连接
	await doConnect({
		namespace: platform,
		updateCommandString: true
	});

	// loading panels
	await loadPanels();

});

</script>

<style>
.main {
	height: calc(100vh - 50px);
	display: flex;
	justify-content: center;
}

.message-text img {
    max-width: 300px;
}


.icon-chat:before {
	font-weight: 1000;
}
</style>
