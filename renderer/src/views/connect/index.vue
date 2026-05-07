<template>
	<div class="connection-container-wrapper">
		<el-splitter class="connection-splitter">
			<el-splitter-panel :min="120" :max="400" size="220" class="splitter-panel-left">
				<div class="server-list-panel">
					<div class="tab-header">
						<div class="tab-item" :class="{ active: activeTab === 'server' }" @click="activeTab = 'server'">
							{{ t('server-tab') }}
						</div>
						<div class="tab-item" :class="{ active: activeTab === 'session' }" @click="activeTab = 'session'">
							{{ t('session-tab') }}
							<span v-if="gatewaySessions.length > 0" class="session-badge">{{ gatewaySessions.length }}</span>
						</div>
					</div>

					<div v-show="activeTab === 'server'" class="list-container">
						<el-scrollbar>
							<div class="list-inner">
								<div class="server-source-chrome">
									<el-button text size="small" type="primary" @click="showAddServerDialog = true">
										{{ t('add') }}
									</el-button>
									<el-button text size="small" :loading="serverLoading" @click="refreshServerList">
										{{ t('refresh') }}
									</el-button>
								</div>

								<div
									v-for="(server, serverIdx) in localServers"
									:key="`${server.id}#${serverIdx}`"
									class="list-item server-config-item"
									:class="{ active: selectedServerId === server.id }"
									@click="selectLocalServer(server)"
								>
									<div class="list-item-content">
										<span class="item-title">{{ server.name || t('unnamed-server') }}</span>
										<span class="item-meta">{{ describeServerType(server) }}</span>
									</div>
									<div class="server-actions" @click.stop>
										<el-button
											type="primary"
											size="small"
											:loading="connectingServerId === server.id"
											@click="connectFromServerConfig(server)"
										>{{ t('connect') }}</el-button>
									</div>
								</div>
								<div v-if="!serverLoading && localServers.length === 0" class="server-empty">
									{{ t('no-local-servers') }}
								</div>
							</div>
						</el-scrollbar>
					</div>

					<div v-show="activeTab === 'session'" class="list-container">
						<el-scrollbar>
							<div class="list-inner">
								<div v-if="gatewaySessionsLoading" class="server-empty">{{ t('loading') }}</div>
								<template v-else>
									<div
										v-for="s in gatewaySessions"
										:key="s.clientId"
										class="list-item server-item"
										:class="{ active: selectedGatewayClientId === s.clientId }"
										@click="selectGatewaySession(s)"
									>
										<div class="list-item-content">
											<span class="item-title name">{{ s.name || t('unnamed-server') }}</span>
											<span class="session-status-tag connected">{{ t('connected') }}</span>
											<span class="item-meta session-client-id" :title="s.clientId">{{ s.version }}</span>
										</div>
										<span class="delete-btn" @click.stop="disconnectGatewaySession(s.clientId)">
											<span class="iconfont icon-delete"></span>
										</span>
									</div>
									<div v-if="gatewaySessions.length === 0" class="server-empty">
										{{ t('no-active-sessions') }}
									</div>
								</template>
							</div>
						</el-scrollbar>
					</div>
				</div>
			</el-splitter-panel>

			<el-splitter-panel class="splitter-panel-right">
				<div class="connection-detail-panel" v-if="activeTab === 'session' && gatewaySessions.length > 0">
					<ConnectionPanel v-if="sessionDetailIndex >= 0" :index="sessionDetailIndex" />
					<div v-else class="server-empty">{{ t('loading') }}</div>
				</div>

				<div class="server-detail-panel" v-else-if="activeTab === 'server' && selectedLocalServer">
					<div class="detail-header">
						<div class="detail-title-wrapper">
							<el-input v-model="editForm.name" :placeholder="t('server-name-placeholder')" class="detail-title-input" />
						</div>
						<div class="detail-header-actions">
							<el-button type="success" :loading="editFormSaving" @click="saveEditedServer">{{ t('save') }}</el-button>
							<el-button type="primary" :loading="connectingServerId === selectedServerId" @click="connectFromDetail">{{ t('connect') }}</el-button>
							<el-button type="danger" plain @click="deleteCurrentServer">{{ t('delete') }}</el-button>
						</div>
					</div>
					<el-scrollbar class="detail-body">
						<div class="connection-setting-content">
							<div class="setting-section">
								<h2>{{ t('connection-settings') }}</h2>
								<div class="setting-options">
									<div class="setting-option connection-method-option">
										<span class="option-title">{{ t('connection-type') }}</span>
										<el-radio-group v-model="editForm.connectionType" size="default" class="connection-method-radio">
											<el-radio-button v-for="option in connectionSelectDataViewOption" :key="option.value" :value="option.value">
												{{ option.label }}
											</el-radio-button>
										</el-radio-group>
									</div>
									<template v-if="editForm.connectionType === 'STDIO'">
										<div class="setting-option">
											<span class="option-title">{{ t('command') }}</span>
											<div class="setting-option-input">
												<el-input v-model="editForm.cmdText" :placeholder="t('server-command-placeholder')" />
											</div>
										</div>
										<div class="setting-option">
											<span class="option-title">{{ t('cwd') }}</span>
											<div class="setting-option-input">
												<el-input v-model="editForm.cwd" :placeholder="t('server-cwd-placeholder')" />
											</div>
										</div>
									</template>
									<template v-else>
										<div class="setting-option">
											<span class="option-title">URL</span>
											<div class="setting-option-input">
												<el-input v-model="editForm.url" placeholder="http://" />
											</div>
										</div>
										<div class="setting-option">
											<span class="option-title">OAuth</span>
											<div class="setting-option-input">
												<el-input v-model="editForm.oauth" />
											</div>
										</div>
									</template>
								</div>
							</div>
							<div class="setting-section connection-env-section">
								<h2>{{ t('env-var') }}</h2>
								<div class="setting-options">
									<div class="setting-option setting-option-add">
										<span class="option-title">{{ t('add-env-var') }}</span>
										<div class="setting-option-inputs">
											<el-input v-model="newEnvKey" :placeholder="t('key')" @keyup.enter="addEditEnvItem" />
											<el-input v-model="newEnvValue" :placeholder="t('value')" @keyup.enter="addEditEnvItem" />
											<el-button type="primary" circle @click="addEditEnvItem">
												<span class="iconfont icon-add"></span>
											</el-button>
										</div>
									</div>
									<div v-for="(envItem, idx) in editForm.envList" :key="idx" class="setting-option setting-option-env-row">
										<span class="option-title option-title--muted">{{ envItem.key || t('key') }}</span>
										<div class="setting-option-inputs">
											<el-input v-model="envItem.key" :placeholder="t('key')" />
											<el-input v-model="envItem.value" type="password" show-password :placeholder="t('value')" />
											<el-button type="danger" circle @click="editForm.envList.splice(idx, 1)">
												<span class="iconfont icon-delete"></span>
											</el-button>
										</div>
									</div>
									<div v-if="editForm.envList.length === 0" class="setting-option env-empty-hint">
										<span class="option-title option-title--muted">{{ t('no-env-vars') }}</span>
									</div>
								</div>
							</div>
							<div class="server-id-info">ID: {{ selectedServerId }}</div>
						</div>
					</el-scrollbar>
				</div>

				<div class="empty-state" v-else>
					<span class="iconfont icon-openmcp"></span>
					<span class="empty-text">{{ activeTab === 'session' ? t('no-connect-right-now') : t('select-server-hint') }}</span>
				</div>
			</el-splitter-panel>
		</el-splitter>

		<el-dialog v-model="showAddServerDialog" :title="t('add-server')" width="520px" @closed="resetServerForm">
			<el-form :model="serverFormData" label-position="top">
				<el-form-item :label="t('server-name')">
					<el-input v-model="serverFormData.name" :placeholder="t('server-name-placeholder')" />
				</el-form-item>
				<el-form-item :label="t('connection-type')">
					<el-select v-model="serverFormData.connectionType" style="width: 100%">
						<el-option value="STDIO" label="STDIO" />
						<el-option value="SSE" label="SSE" />
						<el-option value="STREAMABLE_HTTP" label="STREAMABLE_HTTP" />
					</el-select>
				</el-form-item>
				<el-form-item v-if="serverFormData.connectionType === 'STDIO'" :label="t('server-command')">
					<el-input v-model="serverFormData.cmdText" :placeholder="t('server-command-placeholder')" />
				</el-form-item>
				<el-form-item v-if="serverFormData.connectionType === 'STDIO'" :label="t('server-cwd')">
					<el-input v-model="serverFormData.cwd" :placeholder="t('server-cwd-placeholder')" />
				</el-form-item>
				<el-form-item v-if="serverFormData.connectionType !== 'STDIO'" :label="t('server-url')">
					<el-input v-model="serverFormData.url" :placeholder="t('server-url-placeholder')" />
				</el-form-item>
				<el-form-item :label="t('server-env')">
					<div class="env-list">
						<div v-for="(envItem, idx) in serverFormData.envList" :key="idx" class="env-row">
							<el-input v-model="envItem.key" :placeholder="t('server-env-key')" class="env-input" />
							<span class="env-eq">=</span>
							<el-input v-model="envItem.value" :placeholder="t('server-env-value')" class="env-input" />
							<span class="delete-btn" @click="removeEnvItem(idx)"><span class="iconfont icon-delete"></span></span>
						</div>
						<el-button text size="small" @click="addEnvItem">+ {{ t('server-env-add') }}</el-button>
					</div>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="showAddServerDialog = false">{{ t('cancel') }}</el-button>
				<el-button type="primary" :loading="addServerSaving" @click="saveNewServer">{{ t('save') }}</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import ConnectionPanel from './connection-panel.vue';
import { connectionSelectDataViewOption, mcpClientAdapter } from './core';
import { fetchAndApplyGatewaySessions, type GatewaySessionItem } from './gateway-session-sync';
import { useMessageBridge } from '@/api/message-bridge';
import { panelLoaded } from '@/hook/panel';

import './connection-setting-styles.css';

defineComponent({ name: 'connection' });

const { t } = useI18n();
const activeTab = ref<'server' | 'session'>('server');
const gatewaySessions = ref<GatewaySessionItem[]>([]);
const gatewaySessionsLoading = ref(false);
const selectedGatewayClientId = ref('');

const sessionDetailIndex = computed(() =>
	mcpClientAdapter.clients.findIndex(c => c.clientId === selectedGatewayClientId.value)
);

interface ServerConfig {
	id: string;
	name: string;
	source: 'local';
	connectionType?: string;
	command?: string;
	args?: string[];
	url?: string;
	cwd?: string;
	env?: Record<string, string>;
	serverInfo?: { name?: string; version?: string };
	[key: string]: unknown;
}

const localServers = ref<ServerConfig[]>([]);
const serverLoading = ref(false);
const selectedServerId = ref('');
const connectingServerId = ref('');
const editFormSaving = ref(false);
const newEnvKey = ref('');
const newEnvValue = ref('');

const selectedLocalServer = computed(() => localServers.value.find(s => s.id === selectedServerId.value) || null);

const editForm = ref({
	name: '',
	connectionType: 'STDIO',
	cmdText: '',
	cwd: '',
	url: '',
	oauth: '',
	envList: [] as { key: string; value: string }[]
});

async function refreshGatewaySessions() {
	gatewaySessionsLoading.value = true;
	try {
		const { list, selectedClientId, error } = await fetchAndApplyGatewaySessions(selectedGatewayClientId.value);
		gatewaySessions.value = list;
		selectedGatewayClientId.value = selectedClientId;
		if (error) ElMessage.error(error || t('session-list-load-failed'));
	} catch (e: unknown) {
		ElMessage.error(e instanceof Error ? e.message : String(e));
	} finally {
		gatewaySessionsLoading.value = false;
	}
}

async function selectGatewaySession(s: GatewaySessionItem) {
	const idx = await mcpClientAdapter.attachExistingGatewaySession(s);
	mcpClientAdapter.currentClientIndex = idx;
	selectedGatewayClientId.value = s.clientId;
	if (!panelLoaded.value && mcpClientAdapter.clients.length > 0) {
		await mcpClientAdapter.loadPanels();
	}
}

async function disconnectGatewaySession(clientId: string) {
	try {
		const bridge = useMessageBridge();
		const res = await bridge.commandRequest('disconnect', { clientId });
		if (res.code !== 200) {
			ElMessage.error((res.msg != null ? String(res.msg) : '') || t('session-disconnect-failed'));
			return;
		}
		if (selectedGatewayClientId.value === clientId) selectedGatewayClientId.value = '';
		await refreshGatewaySessions();
	} catch (e: unknown) {
		ElMessage.error(e instanceof Error ? e.message : String(e));
	}
}

watch(activeTab, tab => {
	if (tab === 'session') void refreshGatewaySessions();
});

function describeServerType(server: ServerConfig) {
	if (server.connectionType === 'STDIO') {
		return [server.command, ...(server.args || [])].filter(Boolean).join(' ') || 'STDIO';
	}
	return server.url || server.connectionType || '';
}

async function refreshServerList() {
	serverLoading.value = true;
	try {
		const bridge = useMessageBridge();
		const res = await bridge.commandRequest('servers/list', {});
		if (res.code !== 200) {
			ElMessage.error(res.msg?.toString() || t('load-failed'));
			return;
		}
		localServers.value = (((res.data as any)?.servers || []) as ServerConfig[]).filter(s => s.source === 'local');
		if (selectedServerId.value && !localServers.value.some(s => s.id === selectedServerId.value)) {
			selectedServerId.value = '';
		}
	} catch (error: any) {
		ElMessage.error(error?.message || t('load-failed'));
	} finally {
		serverLoading.value = false;
	}
}

function selectLocalServer(server: ServerConfig) {
	selectedServerId.value = server.id;
	populateEditFormFromServer(server);
}

function populateEditFormFromServer(server: ServerConfig) {
	const type = server.connectionType || 'STDIO';
	editForm.value = {
		name: server.name || '',
		connectionType: type,
		cmdText: type === 'STDIO' ? [server.command, ...(server.args || [])].filter(Boolean).join(' ') : '',
		cwd: (server as any).cwd || '',
		url: type !== 'STDIO' ? ((server as any).url || '') : '',
		oauth: (server as any).oauth || '',
		envList: server.env
			? Object.entries(server.env).map(([key, value]) => ({ key, value: String(value) }))
			: []
	};
	newEnvKey.value = '';
	newEnvValue.value = '';
}

function addEditEnvItem() {
	const key = newEnvKey.value.trim();
	if (!key) return;
	const existing = editForm.value.envList.find(e => e.key === key);
	if (existing) existing.value = newEnvValue.value;
	else editForm.value.envList.push({ key, value: newEnvValue.value });
	newEnvKey.value = '';
	newEnvValue.value = '';
}

function formToServerPayload(fd: typeof editForm.value): Record<string, unknown> {
	const payload: Record<string, unknown> = { name: fd.name.trim(), connectionType: fd.connectionType };
	if (fd.connectionType === 'STDIO') {
		const parts = fd.cmdText.trim().split(/\s+/);
		payload.command = parts[0];
		payload.args = parts.slice(1);
		if (fd.cwd.trim()) payload.cwd = fd.cwd.trim();
	} else {
		payload.url = fd.url.trim();
		if (fd.oauth.trim()) payload.oauth = fd.oauth.trim();
	}
	const envObj: Record<string, string> = {};
	for (const item of fd.envList) if (item.key.trim()) envObj[item.key.trim()] = item.value;
	if (Object.keys(envObj).length > 0) payload.env = envObj;
	return payload;
}

function validateServerForm(fd: typeof editForm.value) {
	if (!fd.name.trim()) return 'server-name-required';
	if (fd.connectionType === 'STDIO' && !fd.cmdText.trim()) return 'server-command-required';
	if (fd.connectionType !== 'STDIO' && !fd.url.trim()) return 'server-url-required';
	return '';
}

async function saveEditedServer() {
	const err = validateServerForm(editForm.value);
	if (err) { ElMessage.warning(t(err)); return; }
	editFormSaving.value = true;
	try {
		const bridge = useMessageBridge();
		const res = await bridge.commandRequest('servers/save', {
			...formToServerPayload(editForm.value),
			id: selectedServerId.value,
			scope: 'local'
		});
		if (res.code === 200) {
			ElMessage.success(t('save-success'));
			await refreshServerList();
		} else {
			ElMessage.error(res.msg?.toString() || t('save-failed'));
		}
	} catch (error: any) {
		ElMessage.error(error?.message || t('save-failed'));
	} finally {
		editFormSaving.value = false;
	}
}

async function connectFromDetail() {
	if (!selectedLocalServer.value || connectingServerId.value) return;
	await connectFromServerConfig({ ...selectedLocalServer.value, ...formToServerPayload(editForm.value) } as ServerConfig);
}

function deleteCurrentServer() {
	const server = selectedLocalServer.value;
	if (server) void deleteServerConfig(server);
}

async function connectFromServerConfig(server: ServerConfig) {
	if (connectingServerId.value) return;
	connectingServerId.value = server.id;
	try {
		const item: any = { ...server };
		if (item.connectionType === 'STDIO' && item.command) {
			item.commandString = [item.command, ...(item.args || [])].join(' ');
		}
		const ok = await mcpClientAdapter.connectServer(item);
		if (ok) {
			const last = mcpClientAdapter.clients[mcpClientAdapter.clients.length - 1];
			selectedGatewayClientId.value = last.clientId;
			await refreshGatewaySessions();
			mcpClientAdapter.currentClientIndex = mcpClientAdapter.clients.findIndex(c => c.clientId === last.clientId);
			activeTab.value = 'session';
			await mcpClientAdapter.loadPanels();
		}
	} finally {
		connectingServerId.value = '';
	}
}

async function deleteServerConfig(server: ServerConfig) {
	try {
		const bridge = useMessageBridge();
		const res = await bridge.commandRequest('servers/delete', { id: server.id });
		if (res.code === 200) {
			localServers.value = localServers.value.filter(s => s.id !== server.id);
			if (selectedServerId.value === server.id) selectedServerId.value = '';
			ElMessage.success(t('delete-success'));
		} else {
			ElMessage.error(res.msg?.toString() || t('delete-failed'));
		}
	} catch (error: any) {
		ElMessage.error(error?.message || t('delete-failed'));
	}
}

const showAddServerDialog = ref(false);
const addServerSaving = ref(false);

function createEmptyServerForm() {
	return {
		name: '',
		connectionType: 'STDIO',
		cmdText: '',
		cwd: '',
		url: '',
		oauth: '',
		envList: [] as { key: string; value: string }[]
	};
}

const serverFormData = ref(createEmptyServerForm());

function resetServerForm() {
	serverFormData.value = createEmptyServerForm();
}

function addEnvItem() {
	serverFormData.value.envList.push({ key: '', value: '' });
}

function removeEnvItem(idx: number) {
	serverFormData.value.envList.splice(idx, 1);
}

async function saveNewServer() {
	const err = validateServerForm(serverFormData.value);
	if (err) { ElMessage.warning(t(err)); return; }
	addServerSaving.value = true;
	try {
		const bridge = useMessageBridge();
		const res = await bridge.commandRequest('servers/save', {
			...formToServerPayload(serverFormData.value),
			scope: 'local'
		});
		if (res.code === 200) {
			showAddServerDialog.value = false;
			ElMessage.success(t('save-success'));
			resetServerForm();
			await refreshServerList();
		} else {
			ElMessage.error(res.msg?.toString() || t('save-failed'));
		}
	} catch (error: any) {
		ElMessage.error(error?.message || t('save-failed'));
	} finally {
		addServerSaving.value = false;
	}
}

onMounted(() => {
	void refreshServerList();
	void refreshGatewaySessions();
});
</script>

<style scoped>
.connection-container-wrapper,
.connection-splitter {
	height: 100%;
}

.connection-splitter :deep(.el-splitter__panel) {
	overflow: hidden;
}

.splitter-panel-left,
.splitter-panel-right,
.server-detail-panel {
	display: flex;
	flex-direction: column;
}

.server-list-panel {
	width: 100%;
	height: 100%;
	border-right: 1px solid var(--el-border-color-light);
	background-color: var(--el-bg-color);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.tab-header {
	display: flex;
	border-bottom: 1px solid var(--el-border-color-light);
	flex-shrink: 0;
}

.tab-item {
	flex: 1;
	padding: 10px 0;
	text-align: center;
	font-size: 13px;
	font-weight: 600;
	cursor: pointer;
	color: var(--el-text-color-secondary);
	border-bottom: 2px solid transparent;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
}

.tab-item.active {
	color: var(--el-color-primary);
	border-bottom-color: var(--el-color-primary);
}

.session-badge {
	min-width: 18px;
	height: 18px;
	padding: 0 4px;
	border-radius: 9px;
	background-color: var(--el-color-primary);
	color: #fff;
	font-size: 11px;
	line-height: 18px;
}

.list-container,
.connection-detail-panel,
.detail-body {
	flex: 1;
	min-height: 0;
}

.list-container .el-scrollbar {
	height: 100%;
}

.list-inner {
	padding: 10px;
}

.server-source-chrome {
	padding: 8px 10px 10px;
	margin: 0 3px 6px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	display: flex;
	justify-content: center;
	gap: 4px;
}

.list-item {
	margin: 3px;
	padding: 10px 12px;
	border-radius: 4px;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 8px;
}

.list-item:hover,
.list-item.active {
	background-color: var(--el-fill-color-light);
}

.list-item.active {
	border-left: 3px solid var(--el-color-primary-light-5);
}

.list-item-content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 2px;
}

.item-title {
	font-weight: bold;
	font-size: 13px;
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.item-meta {
	font-size: 11px;
	color: var(--el-text-color-secondary);
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.server-actions,
.detail-header-actions,
.setting-option-inputs,
.env-row {
	display: flex;
	align-items: center;
	gap: 8px;
}

.delete-btn {
	cursor: pointer;
	color: var(--el-color-danger);
}

.server-empty {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	padding: 12px 10px;
	text-align: center;
}

.session-status-tag.connected {
	font-size: 11px;
	color: var(--el-color-success);
}

.server-detail-panel {
	height: 100%;
	overflow: hidden;
}

.detail-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 24px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	gap: 12px;
}

.detail-title-wrapper,
.setting-option-input,
.setting-option-inputs :deep(.el-input),
.env-input {
	flex: 1;
	min-width: 0;
}

.server-id-info {
	font-size: 12px;
	color: var(--el-text-color-placeholder);
	font-family: Consolas, monospace;
	padding: 8px 0;
	text-align: center;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	color: var(--el-text-color-secondary);
}

.empty-state .iconfont {
	font-size: 128px;
	margin-bottom: 16px;
}

.empty-text {
	font-size: 18px;
}

.env-list {
	width: 100%;
}

.env-row {
	margin-bottom: 6px;
}
</style>
