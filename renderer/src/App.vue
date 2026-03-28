<template>
	<div class="main">
		<Sidebar></Sidebar>
		<MainPanel></MainPanel>

		<Tour v-if="!userHasReadGuide"/>
		<PasswordDialog v-if="useAuth"/>
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
import { initialise } from './views/connect';
import Tour from '@/components/guide/tour.vue';
import { userHasReadGuide } from './components/guide/tour';

import PasswordDialog from '@/components/password-dialog/index.vue';
import { privilegeStatus } from './components/password-dialog/status';
import { useI18n } from 'vue-i18n';
import { patchPasteCommand } from './components/k-input-object/patch';
import { hydrateCloudAuth } from './hook/cloud-auth';
import { hydrateCloudContext } from './hook/cloud-context';

const bridge = useMessageBridge();

// 监听所有消息
bridge.addCommandListener('hello', data => {
	greenLog(`${data.name}`);
	greenLog(`version: ${data.version}`);
}, { once: true });

const route = useRoute();
const router = useRouter();

const useAuth = Boolean(import.meta.env.VITE_USE_AUTH !== "false");
console.log(import.meta.env.VITE_USE_AUTH, useAuth);

privilegeStatus.allow = !Boolean(useAuth);

onMounted(async () => {
    hydrateCloudAuth();
    hydrateCloudContext();

    // https://github.com/microsoft/vscode/issues/232692
    patchPasteCommand();

	// 初始化 css
	setDefaultCss();

	pinkLog('OpenMCP Client 启动');

	// 跳转到首页
	if (route.name !== 'debug') {
		const targetRoute = import.meta.env.BASE_URL + 'debug';
		console.log('go to ' + targetRoute);
		router.push(targetRoute);
	}

	// 进行桥接	
	await bridge.awaitForWebsocket();		

	// 根据是否需要密码进行后续的选择
	if (!privilegeStatus.allow) {
		return;
	}

	document?.addEventListener('click', () => {
		Connection.showPanel = false;
	});

	await initialise();    
});

</script>

<style>
.main {
	height: calc(100vh - 5px);
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
