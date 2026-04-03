<template>
	<div class="connection-container-wrapper">
		<el-splitter class="connection-splitter">
			<el-splitter-panel :min="120" :max="400" size="220" class="splitter-panel-left">
				<div class="server-list-panel">
					<!-- Tab 切换 -->
					<div class="tab-header">
						<div
							class="tab-item"
							:class="{ active: activeTab === 'server' }"
							@click="activeTab = 'server'"
						>
							{{ t('server-tab') }}
						</div>
						<div
							class="tab-item"
							:class="{ active: activeTab === 'session' }"
							@click="activeTab = 'session'"
						>
							{{ t('session-tab') }}
							<span v-if="mcpClientAdapter.clients.length > 0" class="session-badge">
								{{ mcpClientAdapter.clients.length }}
							</span>
						</div>
					</div>

					<!-- Server Tab -->
					<div v-show="activeTab === 'server'" class="list-container">
						<el-scrollbar>
							<div class="list-inner">
								<!-- 本地 Server -->
								<div class="section-header">
									<span>{{ t('local-servers') }}</span>
									<el-button text size="small" @click="refreshServerList">
										{{ t('refresh') }}
									</el-button>
								</div>
							<div
								v-for="server in localServers"
								:key="server.id"
								class="list-item server-config-item"
								:class="{ active: selectedServerId === server.id }"
								@click="selectedServerId = server.id"
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
									<span
										class="delete-btn"
										@click="deleteServerConfig(server)"
									>
										<span class="iconfont icon-delete"></span>
									</span>
								</div>
							</div>
								<div v-if="!serverLoading && localServers.length === 0" class="server-empty">
									{{ t('no-local-servers') }}
								</div>
								<div class="add-server" @click="showAddServerDialog = true">
									<span class="iconfont icon-add"></span>
									<span class="add-server-text">{{ t('add-server') }}</span>
								</div>

								<!-- 云端 Server -->
								<div v-if="isCloudLoggedIn" class="cloud-projects-section">
									<div class="section-header">
										<span>{{ t('cloud-connect-title') }}</span>
										<el-button text size="small" :loading="cloudLoading" @click.stop="loadCloudProjects">
											{{ t('refresh') }}
										</el-button>
									</div>
								<div
									v-for="project in cloudProjects"
									:key="project.id"
									class="cloud-project-item"
								>
									<div class="cloud-project-content">
										<span class="cloud-project-name">{{ project.name }}</span>
										<span class="cloud-project-meta">{{ project.transport }} · {{ project.endpoint }}</span>
									</div>
									<div class="server-actions">
										<el-button
											v-if="project.enabled"
											type="primary"
											size="small"
											:loading="cloudConnectingProjectId === project.id"
											@click="connectCloudProject(project)"
										>{{ t('connect') }}</el-button>
										<el-tag v-else size="small" type="info">
											{{ t('disabled') }}
										</el-tag>
									</div>
								</div>
									<div v-if="!cloudLoading && cloudProjects.length === 0" class="cloud-project-empty">
										{{ t('cloud-connect-empty') }}
									</div>
								</div>
							</div>
						</el-scrollbar>
					</div>

					<!-- Session Tab -->
					<div v-show="activeTab === 'session'" class="list-container">
						<el-scrollbar>
							<div class="list-inner">
								<div
									v-for="(item, index) in mcpClientAdapter.clients"
									:key="index"
									class="list-item server-item"
									:class="{ active: mcpClientAdapter.currentClientIndex === index }"
									@click="selectSession(index)"
								>
									<div class="list-item-content">
										<span class="connect-status">
											<span v-if="item.connectionResult.success" class="success">
												<span class="item-title name">{{ item.connectionResult.name }}</span>
											</span>
											<span v-else>
												<span class="item-title">{{ t('server') }} {{ index + 1 }}</span>
											</span>
										</span>
										<span class="session-status-tag" :class="item.connectionResult.success ? 'connected' : 'disconnected'">
											{{ item.connectionResult.success ? t('connected') : t('disconnected') }}
										</span>
									</div>
									<span
										v-if="mcpClientAdapter.clients.length > 1"
										class="delete-btn"
										@click.stop="deleteSession(index)"
									>
										<span class="iconfont icon-delete"></span>
									</span>
								</div>
								<div v-if="mcpClientAdapter.clients.length === 0" class="server-empty">
									{{ t('no-active-sessions') }}
								</div>
							</div>
						</el-scrollbar>
					</div>
				</div>
			</el-splitter-panel>
			<el-splitter-panel class="splitter-panel-right">
				<div class="connection-detail-panel" v-if="mcpClientAdapter.clients.length > 0">
					<ConnectionPanel :index="mcpClientAdapter.currentClientIndex" />
				</div>
				<div class="empty-state" v-else>
					<span class="iconfont icon-openmcp"></span>
					<span class="empty-text">{{ t('no-connect-right-now') }}</span>
				</div>
			</el-splitter-panel>
		</el-splitter>

		<!-- 添加 Server 对话框 -->
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
import { defineComponent, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ConnectionPanel from './connection-panel.vue';
import { mcpClientAdapter } from './core';
import { useMessageBridge } from '@/api/message-bridge';
import { ElMessage } from 'element-plus';
import { cloudListProjects, type CloudProject } from '@/api/cloud';
import { isCloudLoggedIn } from '@/hook/cloud-auth';
import { setCurrentCloudProject } from '@/hook/cloud-context';

import './connection-setting-styles.css';

defineComponent({ name: 'connection' });

const { t } = useI18n();

const activeTab = ref<'server' | 'session'>('server');

// Server 列表
interface ServerConfig {
	id: string;
	name: string;
	source: 'local' | 'cloud';
	connectionType?: string;
	command?: string;
	args?: string[];
	url?: string;
	cwd?: string;
	[key: string]: unknown;
}

const localServers = ref<ServerConfig[]>([]);
const serverLoading = ref(false);
const selectedServerId = ref('');
const connectingServerId = ref('');

const cloudProjects = ref<CloudProject[]>([]);
const cloudLoading = ref(false);
const cloudConnectingProjectId = ref('');

function describeServerType(server: ServerConfig): string {
	const type = server.connectionType || '未知';
	if (type === 'STDIO') {
		const cmd = server.command || '';
		const args = Array.isArray(server.args) ? server.args.join(' ') : '';
		return `STDIO · ${cmd} ${args}`.trim();
	}
	return `${type} · ${server.url || ''}`;
}

async function refreshServerList() {
	serverLoading.value = true;
	try {
		const bridge = useMessageBridge();
		const res = await bridge.commandRequest('servers/list', {});
		const payload = (res.data ?? res.msg) as any;
		if (res.code === 200 && payload?.servers) {
			localServers.value = payload.servers.filter((s: any) => s.source === 'local');
		}
	} catch (error: any) {
		ElMessage.error(error?.message || t('load-servers-failed'));
	} finally {
		serverLoading.value = false;
	}
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
			mcpClientAdapter.currentClientIndex = mcpClientAdapter.clients.length - 1;
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
			ElMessage.success(t('delete-success'));
		} else {
			ElMessage.error(res.msg?.toString() || t('delete-failed'));
		}
	} catch (error: any) {
		ElMessage.error(error?.message || t('delete-failed'));
	}
}

function selectSession(index: number) {
	mcpClientAdapter.currentClientIndex = index;
}

// ── 添加 Server 对话框 ──
const showAddServerDialog = ref(false);
const addServerSaving = ref(false);

function createEmptyServerForm() {
	return {
		name: '',
		connectionType: 'STDIO' as string,
		cmdText: '',
		cwd: '',
		url: '',
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
	const fd = serverFormData.value;
	if (!fd.name.trim()) { ElMessage.warning(t('server-name-required')); return; }
	if (fd.connectionType === 'STDIO' && !fd.cmdText.trim()) { ElMessage.warning(t('server-command-required')); return; }
	if (fd.connectionType !== 'STDIO' && !fd.url.trim()) { ElMessage.warning(t('server-url-required')); return; }

	addServerSaving.value = true;
	try {
		const bridge = useMessageBridge();
		const payload: Record<string, unknown> = { name: fd.name.trim(), connectionType: fd.connectionType };
		if (fd.connectionType === 'STDIO') {
			const parts = fd.cmdText.trim().split(/\s+/);
			payload.command = parts[0];
			payload.args = parts.slice(1);
			if (fd.cwd.trim()) payload.cwd = fd.cwd.trim();
		} else {
			payload.url = fd.url.trim();
		}
		const envObj: Record<string, string> = {};
		for (const item of fd.envList) { if (item.key.trim()) envObj[item.key.trim()] = item.value; }
		if (Object.keys(envObj).length > 0) payload.env = envObj;

		const res = await bridge.commandRequest('servers/save', payload);
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

function deleteSession(index: number) {
	mcpClientAdapter.clients.splice(index, 1);
	if (mcpClientAdapter.currentClientIndex >= mcpClientAdapter.clients.length) {
		mcpClientAdapter.currentClientIndex = Math.max(0, mcpClientAdapter.clients.length - 1);
	}
}

function mapCloudProjectTransport(project: CloudProject): {
	connectionType: 'STDIO' | 'SSE' | 'STREAMABLE_HTTP';
	commandString?: string;
	url?: string;
} {
	if (project.transport === 'stdio') {
		return { connectionType: 'STDIO', commandString: project.endpoint };
	}
	if (project.transport === 'sse') {
		return { connectionType: 'SSE', url: project.endpoint };
	}
	return { connectionType: 'STREAMABLE_HTTP', url: project.endpoint };
}

async function connectCloudProject(project: CloudProject) {
	if (!project.enabled) {
		ElMessage.warning(t('cloud-connect-project-disabled'));
		return;
	}
	if (cloudConnectingProjectId.value) {
		return;
	}
	cloudConnectingProjectId.value = project.id;
	try {
		setCurrentCloudProject(project.id);
		const mapped = mapCloudProjectTransport(project);
		const item: any = {
			connectionType: mapped.connectionType,
			commandString: mapped.commandString || '',
			url: mapped.url || '',
			name: project.name
		};
		const ok = await mcpClientAdapter.connectServer(item);
		if (ok) {
			mcpClientAdapter.currentClientIndex = mcpClientAdapter.clients.length - 1;
			activeTab.value = 'session';
			await mcpClientAdapter.loadPanels();
			ElMessage.success(t('cloud-connect-success'));
		}
	} catch (error: any) {
		ElMessage.error(error?.message || t('cloud-connect-failed'));
	} finally {
		cloudConnectingProjectId.value = '';
	}
}

async function loadCloudProjects() {
	if (!isCloudLoggedIn.value) {
		cloudProjects.value = [];
		return;
	}
	cloudLoading.value = true;
	try {
		cloudProjects.value = await cloudListProjects();
	} catch (error: any) {
		ElMessage.error(error?.message || t('cloud-load-projects-failed'));
	} finally {
		cloudLoading.value = false;
	}
}

watch(isCloudLoggedIn, () => {
	loadCloudProjects();
});

onMounted(() => {
	refreshServerList();
	loadCloudProjects();
});
</script>

<style scoped>
.connection-container-wrapper {
	height: 100%;
}

.connection-splitter {
	height: 100%;
}

.connection-splitter :deep(.el-splitter__panel) {
	overflow: hidden;
}

.splitter-panel-left {
	display: flex;
	flex-direction: column;
}

.splitter-panel-right {
	display: flex;
	flex-direction: column;
	min-width: 0;
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

/* Tab header */
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
	transition: all 0.2s;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
}

.tab-item:hover {
	color: var(--el-text-color-primary);
	background-color: var(--el-fill-color-lighter);
}

.tab-item.active {
	color: var(--el-color-primary);
	border-bottom-color: var(--el-color-primary);
}

.session-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 18px;
	height: 18px;
	padding: 0 4px;
	border-radius: 9px;
	background-color: var(--el-color-primary);
	color: #fff;
	font-size: 11px;
	font-weight: 600;
	line-height: 1;
}

.section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 6px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.server-list-panel .list-container {
	flex: 1;
	min-height: 0;
}

.server-list-panel .list-container .el-scrollbar {
	height: 100%;
}

.server-list-panel .list-inner {
	padding: 10px;
}

.server-list-panel .list-item {
	margin: 3px;
	padding: 10px 12px;
	border-radius: 0.3em;
	user-select: none;
	cursor: pointer;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 8px;
	transition: var(--animation-3s);
}

.server-list-panel .list-item:hover {
	background-color: var(--el-fill-color-light);
}

.server-list-panel .list-item.active {
	background-color: var(--el-fill-color-light);
	border-left: 3px solid var(--el-color-primary-light-5);
}

.server-list-panel .list-item-content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 2px;
}

.server-list-panel .item-title {
	font-weight: bold;
	font-size: 13px;
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.server-list-panel .item-meta {
	font-size: 11px;
	color: var(--el-text-color-secondary);
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.server-list-panel .name {
	max-width: 140px;
}

.server-list-panel .connect-status {
	display: flex;
	align-items: center;
	gap: 4px;
}

.server-list-panel .connect-status .success {
	display: flex;
	align-items: center;
}

.session-status-tag {
	font-size: 11px;
	padding: 1px 6px;
	border-radius: 4px;
	line-height: 1.4;
}

.session-status-tag.connected {
	color: var(--el-color-success);
	background-color: var(--el-color-success-light-9);
}

.session-status-tag.disconnected {
	color: var(--el-text-color-secondary);
	background-color: var(--el-fill-color);
}

.server-actions {
	display: flex;
	align-items: center;
	gap: 6px;
	flex-shrink: 0;
}

.server-list-panel .delete-btn {
	cursor: pointer;
	color: var(--el-color-danger);
	flex-shrink: 0;
}
.server-list-panel .delete-btn:hover {
	opacity: 0.8;
}

.server-list-panel .add-server {
	padding: 10px 12px;
	text-align: center;
	cursor: pointer;
	border-radius: 0.3em;
	border: 1px dashed var(--el-border-color);
	margin: 3px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	transition: var(--animation-3s);
}
.server-list-panel .add-server:hover {
	background-color: var(--el-fill-color-light);
	border-color: var(--el-color-primary-light-5);
}
.server-list-panel .add-server-text {
	font-size: 13px;
}

.server-empty {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	padding: 12px 10px;
	text-align: center;
}

.cloud-projects-section {
	margin: 8px 3px 0;
	padding-top: 10px;
	border-top: 1px solid var(--el-border-color-lighter);
}

.cloud-project-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 8px 10px;
	border-radius: 6px;
	cursor: pointer;
}

.cloud-project-item:hover {
	background-color: var(--el-fill-color-light);
}

.cloud-project-content {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.cloud-project-name {
	font-size: 13px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.cloud-project-meta {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.cloud-project-empty {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	padding: 6px 10px;
}

.connection-detail-panel {
	flex: 1;
	min-width: 0;
	height: 100%;
	overflow: hidden;
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
	color: var(--el-text-color-secondary);
}

.add-server-form {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.form-field > label {
	display: block;
	font-size: 14px;
	color: var(--el-text-color-regular);
	margin-bottom: 6px;
	line-height: 22px;
}
.env-list { width: 100%; }
.env-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.env-input { flex: 1; min-width: 0; }
.env-eq { color: var(--el-text-color-secondary); font-weight: bold; flex-shrink: 0; }
</style>
