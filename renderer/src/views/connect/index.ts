import { getTour, loadSetting } from "@/hook/setting";
import { ElLoading } from "element-plus";
import { pinkLog } from "../setting/util";
import { mcpClientAdapter } from "./core";
import { isConnecting } from "@/components/sidebar/connected";
import { ref } from "vue";

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

	isConnecting.value = false;
}