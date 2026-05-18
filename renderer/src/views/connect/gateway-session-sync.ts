import { useMessageBridge } from '@/api/message-bridge';
import { mcpClientAdapter } from './core';
import { panelLoaded } from '@/hook/panel';
import type { ConnectionType } from './type';

export interface GatewaySessionItem {
	clientId: string;
	name: string;
	version: string;
	connectionType?: ConnectionType;
	type?: string;
	transport?: string;
	command?: string;
	args?: string[];
	commandString?: string;
	url?: string;
	headers?: Record<string, string>;
	cwd?: string;
	env?: Record<string, string>;
	connectionId?: string;
	storageScope?: 'user' | 'workspace';
	workspacePath?: string;
}

export function normalizeConnectListPayload(res: { msg?: unknown; data?: unknown }): GatewaySessionItem[] {
	const payload = res.msg ?? res.data;
	if (Array.isArray(payload)) {
		return payload as GatewaySessionItem[];
	}
	return [];
}

function hasConnectionSignature(item: GatewaySessionItem): boolean {
	return Boolean(item.connectionType || item.type || item.transport || item.url || item.command || item.commandString);
}

function getSavedServerName(item: any): string {
	return String(item?.serverInfo?.name || item?.name || '').trim();
}

function applySavedServerFallback(
	session: GatewaySessionItem,
	savedServers: any[],
	sessionCount: number
): GatewaySessionItem {
	if (hasConnectionSignature(session)) {
		return session;
	}

	const matched = savedServers.find(item => getSavedServerName(item) === session.name)
		|| (sessionCount === 1 && savedServers.length === 1 ? savedServers[0] : undefined);

	if (!matched) {
		return session;
	}

	return {
		...session,
		connectionType: normalizeConnectionType(matched.connectionType || matched.type || matched.transport),
		command: matched.command,
		args: matched.args,
		commandString: matched.commandString,
		url: matched.url,
		headers: normalizeHeaders(matched.headers),
		cwd: matched.cwd,
		env: matched.env,
		connectionId: matched.connectionId || matched.id,
		storageScope: matched.storageScope,
		workspacePath: matched.workspacePath
	};
}

function normalizeConnectionType(type?: string): ConnectionType | undefined {
	if (!type) return undefined;
	const normalized = type.trim().toUpperCase().replace(/[-\s]/g, '_');
	if (normalized === 'STDIO') return 'STDIO';
	if (normalized === 'SSE') return 'SSE';
	if (normalized === 'STREAMABLE_HTTP' || normalized === 'STREAMABLEHTTP' || normalized === 'HTTP') return 'STREAMABLE_HTTP';
	return undefined;
}

function normalizeHeaders(value?: Record<string, any>): Record<string, string> | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const headers: Record<string, string> = {};
	for (const [key, item] of Object.entries(value)) {
		const headerName = key.trim();
		if (!headerName || item === undefined || item === null) continue;
		headers[headerName] = String(item);
	}
	return Object.keys(headers).length > 0 ? headers : undefined;
}

function normalizeSessionSignature(session: GatewaySessionItem): GatewaySessionItem {
	const connectionType = normalizeConnectionType(session.connectionType || session.type || session.transport)
		|| (session.url ? 'STREAMABLE_HTTP' : undefined);
	return {
		...session,
		headers: normalizeHeaders(session.headers),
		...(connectionType ? { connectionType } : {})
	};
}

/**
 * 拉取 Gateway connect/list，同步 mcpClientAdapter.clients（与 CLI 一致）。
 * 若已有活跃会话且面板尚未加载，则拉取 panel/load，避免 Debug 里点了「工具」后 v-if="panelLoaded" 整块不渲染导致白屏。
 */
export async function fetchAndApplyGatewaySessions(previousSelectedId: string): Promise<{
	list: GatewaySessionItem[];
	selectedClientId: string;
	error?: string;
}> {
	const bridge = useMessageBridge();
	const res = await bridge.commandRequest('connect/list', {});
	if (res.code !== 200) {
		const msg = res.msg != null ? String(res.msg) : '';
		return {
			list: [],
			selectedClientId: '',
			error: msg || 'connect/list failed'
		};
	}
	const rawList = normalizeConnectListPayload(res);
	let savedServers: any[] = [];
	try {
		savedServers = await mcpClientAdapter.getLaunchSignature();
	} catch {
		savedServers = [];
	}
	const list = rawList
		.map(session => applySavedServerFallback(session, savedServers, rawList.length))
		.map(normalizeSessionSignature);
	const ids = new Set(list.map(s => s.clientId));

	for (let i = mcpClientAdapter.clients.length - 1; i >= 0; i--) {
		const client = mcpClientAdapter.clients[i];
		// 保留本地未连接的草稿（没有 clientId 的），避免用户正在编辑的新建配置被意外清空
		if (!client.clientId) {
			continue;
		}
		if (!ids.has(client.clientId)) {
			mcpClientAdapter.clients.splice(i, 1);
		}
	}

	if (list.length === 0) {
		mcpClientAdapter.currentClientIndex = 0;
		return { list, selectedClientId: '' };
	}

	for (const s of list) {
		await mcpClientAdapter.attachExistingGatewaySession(s);
	}

	const finalOrdered: typeof mcpClientAdapter.clients = [];
	for (const s of list) {
		const c = mcpClientAdapter.clients.find(cl => cl.clientId === s.clientId);
		if (c) {
			finalOrdered.push(c);
		}
	}
	// 保留本地未连接的草稿，避免用户正在编辑的配置被 Gateway 会话同步覆盖而消失
	const localDrafts = mcpClientAdapter.clients.filter(c => !c.clientId);
	mcpClientAdapter.clients.splice(0, mcpClientAdapter.clients.length, ...finalOrdered, ...localDrafts);

	let nextSelected = previousSelectedId;
	if (!nextSelected || !ids.has(nextSelected)) {
		nextSelected = list[0].clientId;
	}
	mcpClientAdapter.currentClientIndex = mcpClientAdapter.clients.findIndex(c => c.clientId === nextSelected);

	if (list.length > 0 && !panelLoaded.value) {
		await mcpClientAdapter.loadPanels();
	}

	return { list, selectedClientId: nextSelected };
}
