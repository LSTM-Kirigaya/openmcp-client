export interface OpenMcpRuntimeConfig {
	websocketUrl?: unknown;
	useAuth?: unknown;
}

export function getOpenMcpRuntimeConfig(): OpenMcpRuntimeConfig | undefined {
	return (window as any).__OPENMCP_RUNTIME_CONFIG__ as OpenMcpRuntimeConfig | undefined;
}

export function getRuntimeWebSocketUrl(): string | undefined {
	const runtimeConfig = getOpenMcpRuntimeConfig();
	if (typeof runtimeConfig?.websocketUrl === 'string' && runtimeConfig.websocketUrl.trim()) {
		return runtimeConfig.websocketUrl;
	}

	const viteWebSocketUrl = import.meta.env.VITE_WEBSOCKET_URL;
	if (typeof viteWebSocketUrl === 'string' && viteWebSocketUrl.trim()) {
		return viteWebSocketUrl;
	}

	return undefined;
}

export function getRuntimeUseAuth(): boolean {
	const runtimeConfig = getOpenMcpRuntimeConfig();
	if (typeof runtimeConfig?.useAuth === 'boolean') {
		return runtimeConfig.useAuth;
	}

	return import.meta.env.VITE_USE_AUTH !== 'false';
}
