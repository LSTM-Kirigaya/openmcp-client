<template>
	<div class="main">
		<Sidebar></Sidebar>
		<MainPanel></MainPanel>
	</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { Connection } from './components/sidebar/sidebar';

import Sidebar from '@/components/sidebar/index.vue';
import MainPanel from '@/components/main-panel/index.vue';
import { setDefaultCss } from './hook/css';
import { pinkLog } from './views/setting/util';
import { acquireVsCodeApi, useMessageBridge } from './api/message-bridge';
import { connectionArgs, connectionMethods, connectionResult, doConnect } from './views/connect/connection';
import { loadSetting } from './hook/setting';
import { loadPanels } from './hook/panel';

const bridge = useMessageBridge();

// 监听所有消息
bridge.addCommandListener('hello', data => {
	pinkLog(`${data.name} 上线`);
	pinkLog(`version: ${data.version}`);
}, { once: true });


onMounted(() => {
    // 初始化 css
	setDefaultCss();

	document.addEventListener('click', () => {
		Connection.showPanel = false;
	});

	pinkLog('OpenMCP Client 启动');

    // 如果是 debug 模式，直接连接项目中的服务器
    if (acquireVsCodeApi === undefined) {
        connectionArgs.commandString = 'mcp run ../servers/main.py';
        connectionMethods.current = 'STDIO';

        bridge.addCommandListener('connect', data => {
            const { code, msg } = data;            
            connectionResult.success = (code === 200);
            connectionResult.logString = msg;
        }, { once: true });



        setTimeout(() => {
			// 初始化 设置
			loadSetting();

			// 初始化 tab
			loadPanels();
			
            doConnect();

		// 200 是我的电脑上的 ws 的连接时间，部署环境中不存在 ws 连接延时的问题，所以
		// 可以直接不管
        }, 200);
    }
});

</script>

<style>
.main {
	height: calc(100vh - 50px);
	display: flex;
	justify-content: center;
}
</style>
