import { getTour, loadSetting } from "@/hook/setting";
import { ElLoading } from "element-plus";
import { pinkLog } from "../setting/util";
import { mcpClientAdapter } from "./core";
import { fetchAndApplyGatewaySessions } from "./gateway-session-sync";
import { isConnecting } from "@/components/sidebar/connected";
import { ref } from "vue";
import { workspaceManager } from "@/views/workspace/core";

export const mcpServerAddRef = ref<any>(null);

export async function initialise() {

	pinkLog('准备请求设置');

    const loading = ElLoading.service({
		fullscreen: true,
		lock: true,
		text: 'Loading',
		background: 'rgba(0, 0, 0, 0.7)'
	});
    
	// 加载全局设置
	loadSetting();

	// 获取引导状态
	await getTour();

	loading.close();

	// 注册消息监听器（不再自动连接 Server）
	await mcpClientAdapter.launch();

	// 加载工作区列表并尝试自动恢复上次的工作区
	try {
		const autoConnected = await workspaceManager.autoConnectLastWorkspace();
		if (!autoConnected) {
			// 若未自动连接，同步 Gateway 已有会话
			await fetchAndApplyGatewaySessions('');
		}
	} catch (e) {
		pinkLog(`工作区自动恢复跳过: ${e}`);
		try {
			await fetchAndApplyGatewaySessions('');
		} catch (gatewayErr) {
			pinkLog(`Gateway 会话同步跳过: ${gatewayErr}`);
		}
	}

	isConnecting.value = false;
}