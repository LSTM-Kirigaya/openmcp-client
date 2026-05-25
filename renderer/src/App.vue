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
import { getSavedDefaultRoute, saveDefaultRoute } from './router';

import Sidebar from '@/components/sidebar/index.vue';
import MainPanel from '@/components/main-panel/index.vue';
import { setDefaultCss } from './hook/css';
import { greenLog, pinkLog } from './views/setting/util';
import { useMessageBridge } from './api/message-bridge';
import { getRuntimeUseAuth } from './api/runtime-config';
import { initialise } from './views/connect';
import Tour from '@/components/guide/tour.vue';
import { userHasReadGuide } from './components/guide/tour';

import PasswordDialog from '@/components/password-dialog/index.vue';
import { privilegeStatus } from './components/password-dialog/status';
import { useI18n } from 'vue-i18n';
import { patchPasteCommand } from './components/k-input-object/patch';

const bridge = useMessageBridge();

// 监听所有消息
bridge.addCommandListener('hello', data => {
	greenLog(`${data.name}`);
	greenLog(`version: ${data.version}`);
}, { once: true });

const route = useRoute();
const router = useRouter();

const useAuth = getRuntimeUseAuth();
console.log('useAuth', useAuth);

privilegeStatus.allow = !Boolean(useAuth);

onMounted(async () => {
    // https://github.com/microsoft/vscode/issues/232692
    patchPasteCommand();

	// 初始化 css
	setDefaultCss();

	pinkLog('OpenMCP Client 启动');

	const currentPath = window.location.pathname;
	const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
	const isRootPath = currentPath === '/' || currentPath === base || currentPath === base + '/';

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

	// 根路径智能重定向：根据连接状态决定默认页面
	if (isRootPath) {
		const savedRoute = getSavedDefaultRoute();
		let targetRoute: string;
		if (savedRoute) {
			targetRoute = savedRoute;
		} else {
			// 动态导入以避免循环依赖
			const { mcpClientAdapter } = await import('./views/connect/core');
			if (mcpClientAdapter.connected) {
				targetRoute = import.meta.env.BASE_URL + 'debug';
				} else {
				targetRoute = import.meta.env.BASE_URL + 'workspace';
				}
		}
		console.log('go to ' + targetRoute);
		router.push(targetRoute);
		// 确保记录这次使用的路径
		if (!savedRoute) {
			saveDefaultRoute(targetRoute);
		}
	}
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

.user-avatar {
    display: flex;
    align-items: flex-start;
}

.user-avatar-mark {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--main-light-color-20, rgba(99, 102, 241, 0.2));
    border: 1px solid var(--main-light-color-40, rgba(99, 102, 241, 0.4));
    color: var(--main-color, var(--foreground));
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
}

.message-text .openmcp-markdown-table {
    margin: 8px 0;
    overflow-x: auto;
}

.message-text table {
    width: 100%;
    min-width: 100%;
    border-collapse: collapse;
}

.message-text > table {
    display: block;
    max-width: 100%;
    margin: 8px 0;
    overflow-x: auto;
    border: 1px solid var(--sidebar-item-border, var(--el-border-color, rgba(127, 127, 127, 0.35)));
    border-radius: 6px;
}

.message-text th,
.message-text td {
    padding: 6px 10px;
    border: 1px solid var(--sidebar-item-border, var(--el-border-color, rgba(127, 127, 127, 0.35)));
    vertical-align: top;
    text-align: left;
    word-break: break-word;
}

.message-text th {
    background: var(--sidebar-item-selected, var(--el-fill-color-light, rgba(127, 127, 127, 0.12)));
    color: var(--foreground, var(--el-text-color-primary));
    font-weight: 700;
}

.message-text td {
    background: var(--el-input-bg-color, var(--el-fill-color-blank));
}

.message-text tr:nth-child(even) td {
    background: var(--sidebar-item-hover, rgba(127, 127, 127, 0.06));
}

.icon-chat:before {
	font-weight: 1000;
}
</style>
