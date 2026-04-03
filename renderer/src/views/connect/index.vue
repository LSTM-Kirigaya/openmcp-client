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
								<div class="cloud-context-toolbar">
									<div class="cloud-context-row">
										<span class="cloud-context-label">{{ t('runtime-mode') }}</span>
										<el-segmented
											:model-value="cloudContext.mode"
											:options="runtimeModeOptions"
											size="small"
											@change="onRuntimeModeChange"
										/>
									</div>
									<div v-if="cloudContext.mode === 'cloud' && isCloudLoggedIn" class="cloud-context-row">
										<span class="cloud-context-label">{{ t('cloud-current-project') }}</span>
										<el-select
											:model-value="cloudContext.currentProjectId"
											:placeholder="t('cloud-select-project')"
											class="cloud-current-project-select"
											size="small"
											@change="onCurrentProjectSelect"
										>
											<el-option
												v-for="item in cloudProjects"
												:key="item.id"
												:label="item.name"
												:value="item.id"
											/>
										</el-select>
									</div>
								</div>
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
										<div class="section-header-actions">
											<el-button text size="small" type="primary" @click.stop="openCreateCloudProjectDialog">
												{{ t('add') }}
											</el-button>
											<el-button text size="small" :loading="cloudLoading" @click.stop="loadCloudProjects">
												{{ t('refresh') }}
											</el-button>
										</div>
									</div>
								<div
									v-for="project in cloudProjects"
									:key="project.id"
							class="cloud-project-item"
							:class="{ active: selectedServerId === project.id && selectedItemSource === 'cloud' }"
							@click="selectCloudProject(project)"
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
				<!-- Session 连接面板 -->
				<div class="connection-detail-panel" v-if="activeTab === 'session' && mcpClientAdapter.clients.length > 0">
					<ConnectionPanel :index="mcpClientAdapter.currentClientIndex" />
				</div>

				<!-- 云端项目：配置、协作（成员/邀请） -->
				<CloudServerDetail
					v-else-if="activeTab === 'server' && selectedItemSource === 'cloud' && selectedCloudProject"
					:project="selectedCloudProject"
					:connect-loading="cloudConnectingProjectId === selectedServerId"
					@refresh-list="loadCloudProjects"
					@deleted="onCloudProjectDeleted"
					@connect="connectCloudFromDetail"
				/>

				<!-- 本地 Server 配置编辑面板 -->
				<div class="server-detail-panel" v-else-if="activeTab === 'server' && hasSelectedItem && selectedItemSource === 'local'">
					<div class="detail-header">
						<div class="detail-title-wrapper">
							<el-input
								v-model="editForm.name"
								:placeholder="t('server-name-placeholder')"
								class="detail-title-input"
							/>
						</div>
						<div class="detail-header-actions">
							<el-button
								type="success"
								:loading="editFormSaving"
								@click="saveEditedServer"
							>{{ t('save') }}</el-button>
							<el-button
								type="primary"
								:loading="connectingServerId === selectedServerId"
								@click="connectFromDetail"
							>{{ t('connect') }}</el-button>
							<el-button
								type="danger"
								plain
								@click="deleteCurrentServer"
							>{{ t('delete') }}</el-button>
						</div>
					</div>
					<el-scrollbar class="detail-body">
						<div class="connection-setting-content">
							<div class="setting-section">
								<h2>{{ t('connection-settings') }}</h2>
								<div class="setting-options">
									<div class="setting-option connection-method-option">
										<span class="option-title">{{ t('connection-type') }}</span>
										<el-radio-group
											v-model="editForm.connectionType"
											size="default"
											class="connection-method-radio"
										>
											<el-radio-button
												v-for="option in connectionSelectDataViewOption"
												:key="option.value"
												:value="option.value"
											>
												{{ option.label }}
											</el-radio-button>
										</el-radio-group>
									</div>
									<template v-if="editForm.connectionType === 'STDIO'">
										<div class="setting-option">
											<span class="option-title">{{ t('command') }}</span>
											<div class="setting-option-input">
												<el-input
													v-model="editForm.cmdText"
													:placeholder="t('server-command-placeholder')"
												/>
											</div>
										</div>
										<div class="setting-option">
											<span class="option-title">{{ t('cwd') }}</span>
											<div class="setting-option-input">
												<el-input
													v-model="editForm.cwd"
													:placeholder="t('server-cwd-placeholder')"
												/>
											</div>
										</div>
									</template>
									<template v-else>
										<div class="setting-option">
											<span class="option-title">URL</span>
											<div class="setting-option-input">
												<el-input
													v-model="editForm.url"
													placeholder="http://"
												/>
											</div>
										</div>
										<div class="setting-option">
											<span class="option-title">OAuth</span>
											<div class="setting-option-input">
												<el-input
													v-model="editForm.oauth"
													placeholder=""
												/>
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
									<div
										v-for="(envItem, idx) in editForm.envList"
										:key="idx"
										class="setting-option setting-option-env-row"
									>
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
							<div class="server-id-info">
								ID: {{ selectedServerId }}
							</div>
						</div>
					</el-scrollbar>
				</div>

				<!-- 空状态 -->
				<div class="empty-state" v-else>
					<span class="iconfont icon-openmcp"></span>
					<span class="empty-text">{{ activeTab === 'session' ? t('no-connect-right-now') : t('select-server-hint') }}</span>
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

		<el-dialog v-model="showCreateCloudProjectDialog" :title="t('add')" width="520px" @closed="resetCloudCreateForm">
			<el-form :model="cloudCreateForm" label-position="top">
				<el-form-item :label="t('cloud-project-name')" required>
					<el-input v-model="cloudCreateForm.name" />
				</el-form-item>
				<el-form-item :label="t('connection-type')" required>
					<el-select v-model="cloudCreateForm.transport" style="width: 100%;">
						<el-option label="streamable_http" value="http" />
						<el-option label="sse" value="sse" />
						<el-option label="stdio" value="stdio" />
					</el-select>
				</el-form-item>
				<el-form-item :label="t('cloud-project-endpoint')" required>
					<el-input v-model="cloudCreateForm.endpoint" />
				</el-form-item>
				<el-form-item :label="t('description')">
					<el-input v-model="cloudCreateForm.description" type="textarea" />
				</el-form-item>
				<el-form-item :label="t('status')">
					<el-switch v-model="cloudCreateForm.enabled" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="showCreateCloudProjectDialog = false">{{ t('cancel') }}</el-button>
				<el-button type="primary" :loading="cloudCreateSaving" @click="submitCloudCreateProject">{{ t('save') }}</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ConnectionPanel from './connection-panel.vue';
import CloudServerDetail from './cloud-server-detail.vue';
import { connectionSelectDataViewOption, mcpClientAdapter } from './core';
import { useMessageBridge } from '@/api/message-bridge';
import { ElMessage } from 'element-plus';
import { cloudCreateProject, cloudListProjects, type CloudProject } from '@/api/cloud';
import { isCloudLoggedIn } from '@/hook/cloud-auth';
import { cloudContext, setCurrentCloudProject, setRuntimeMode } from '@/hook/cloud-context';

import './connection-setting-styles.css';

defineComponent({ name: 'connection' });

const { t } = useI18n();

const activeTab = ref<'server' | 'session'>('server');

const runtimeModeOptions = computed(() => [
	{ label: t('runtime-mode-local'), value: 'local' },
	{ label: t('runtime-mode-cloud'), value: 'cloud' }
]);

function onRuntimeModeChange(value: unknown) {
	if (value === 'cloud' || value === 'local') {
		setRuntimeMode(value);
	}
}

function onCurrentProjectSelect(projectId: string) {
	setCurrentCloudProject(projectId);
	const p = cloudProjects.value.find(x => x.id === projectId);
	if (p) {
		selectedServerId.value = projectId;
		selectedItemSource.value = 'cloud';
	}
}

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
const selectedItemSource = ref<'local' | 'cloud'>('local');

const selectedLocalServer = computed(() => {
	if (selectedItemSource.value !== 'local') return null;
	return localServers.value.find(s => s.id === selectedServerId.value) || null;
});
const selectedCloudProject = computed(() => {
	if (selectedItemSource.value !== 'cloud') return null;
	return cloudProjects.value.find(p => p.id === selectedServerId.value) || null;
});
const hasSelectedItem = computed(() => {
	return (selectedItemSource.value === 'local' && selectedLocalServer.value !== null) ||
	       (selectedItemSource.value === 'cloud' && selectedCloudProject.value !== null);
});

interface EditFormData {
	name: string;
	connectionType: string;
	cmdText: string;
	cwd: string;
	url: string;
	oauth: string;
	envList: { key: string; value: string }[];
}

const editForm = ref<EditFormData>({
	name: '', connectionType: 'STDIO', cmdText: '', cwd: '', url: '', oauth: '', envList: []
});
const editFormSaving = ref(false);
const newEnvKey = ref('');
const newEnvValue = ref('');

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

function selectLocalServer(server: ServerConfig) {
	selectedServerId.value = server.id;
	selectedItemSource.value = 'local';
	populateEditFormFromServer(server);
}

function selectCloudProject(project: CloudProject) {
	selectedServerId.value = project.id;
	selectedItemSource.value = 'cloud';
	setCurrentCloudProject(project.id);
}

function populateEditFormFromServer(server: ServerConfig) {
	const type = server.connectionType || 'STDIO';
	editForm.value = {
		name: server.name || '',
		connectionType: type,
		cmdText: type === 'STDIO' ? [server.command, ...(server.args || [])].join(' ') : '',
		cwd: (server as any).cwd || '',
		url: type !== 'STDIO' ? ((server as any).url || '') : '',
		oauth: (server as any).oauth || '',
		envList: server.env
			? Object.entries(server.env as Record<string, string>).map(([key, value]) => ({ key, value: String(value) }))
			: []
	};
	newEnvKey.value = '';
	newEnvValue.value = '';
}

function addEditEnvItem() {
	const key = newEnvKey.value.trim();
	const value = newEnvValue.value;
	if (!key) return;
	const existing = editForm.value.envList.find(e => e.key === key);
	if (existing) {
		existing.value = value;
	} else {
		editForm.value.envList.push({ key, value });
	}
	newEnvKey.value = '';
	newEnvValue.value = '';
}

async function saveEditedServer() {
	const fd = editForm.value;
	if (!fd.name.trim()) { ElMessage.warning(t('server-name-required')); return; }
	if (fd.connectionType === 'STDIO' && !fd.cmdText.trim()) { ElMessage.warning(t('server-command-required')); return; }
	if (fd.connectionType !== 'STDIO' && !fd.url.trim()) { ElMessage.warning(t('server-url-required')); return; }

	editFormSaving.value = true;
	try {
		const bridge = useMessageBridge();
		const payload: Record<string, unknown> = {
			id: selectedServerId.value,
			name: fd.name.trim(),
			connectionType: fd.connectionType
		};
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
		for (const item of fd.envList) { if (item.key.trim()) envObj[item.key.trim()] = item.value; }
		if (Object.keys(envObj).length > 0) payload.env = envObj;

		const res = await bridge.commandRequest('servers/save', payload);
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
	if (selectedItemSource.value !== 'local') return;
	if (connectingServerId.value) return;
	connectingServerId.value = selectedServerId.value;
	try {
		const fd = editForm.value;
		const item: any = { connectionType: fd.connectionType, name: fd.name };
		if (fd.connectionType === 'STDIO') {
			item.commandString = fd.cmdText;
			if (fd.cwd.trim()) item.cwd = fd.cwd;
		} else {
			item.url = fd.url;
			if (fd.oauth.trim()) item.oauth = fd.oauth;
		}
		const envObj: Record<string, string> = {};
		for (const e of fd.envList) { if (e.key.trim()) envObj[e.key.trim()] = e.value; }
		if (Object.keys(envObj).length > 0) item.env = envObj;

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

function deleteCurrentServer() {
	const server = selectedLocalServer.value;
	if (!server) return;
	deleteServerConfig(server);
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

const showCreateCloudProjectDialog = ref(false);
const cloudCreateSaving = ref(false);
const cloudCreateForm = ref({
	name: '',
	transport: 'http' as 'stdio' | 'sse' | 'http',
	endpoint: '',
	description: '',
	enabled: true
});

function openCreateCloudProjectDialog() {
	cloudCreateForm.value = {
		name: '',
		transport: 'http',
		endpoint: '',
		description: '',
		enabled: true
	};
	showCreateCloudProjectDialog.value = true;
}

function resetCloudCreateForm() {
	cloudCreateForm.value = {
		name: '',
		transport: 'http',
		endpoint: '',
		description: '',
		enabled: true
	};
}

async function submitCloudCreateProject() {
	const f = cloudCreateForm.value;
	if (!f.name?.trim() || !f.transport || !f.endpoint?.trim()) {
		ElMessage.warning(t('cloud-project-required'));
		return;
	}
	cloudCreateSaving.value = true;
	try {
		const created = await cloudCreateProject({
			name: f.name.trim(),
			transport: f.transport,
			endpoint: f.endpoint.trim(),
			description: f.description,
			enabled: f.enabled
		});
		ElMessage.success(t('cloud-project-created'));
		showCreateCloudProjectDialog.value = false;
		resetCloudCreateForm();
		await loadCloudProjects();
		if (!cloudContext.currentProjectId) {
			setCurrentCloudProject(created.id);
		}
		selectedServerId.value = created.id;
		selectedItemSource.value = 'cloud';
	} catch (error: any) {
		ElMessage.error(error?.message || t('error'));
	} finally {
		cloudCreateSaving.value = false;
	}
}

function onCloudProjectDeleted() {
	selectedServerId.value = '';
}

async function connectCloudFromDetail(project: CloudProject) {
	await connectCloudProject(project);
}

async function loadCloudProjects() {
	if (!isCloudLoggedIn.value) {
		cloudProjects.value = [];
		return;
	}
	cloudLoading.value = true;
	try {
		cloudProjects.value = await cloudListProjects();
		if (cloudContext.mode === 'cloud' && cloudProjects.value.length > 0) {
			if (!cloudProjects.value.some(item => item.id === cloudContext.currentProjectId)) {
				setCurrentCloudProject(cloudProjects.value[0]?.id || '');
			}
		}
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

/* Server 配置编辑面板 */
.server-detail-panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

.detail-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 24px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	flex-shrink: 0;
	gap: 12px;
}

.detail-title-wrapper {
	flex: 1;
	min-width: 0;
}

.detail-title-input :deep(.el-input__wrapper) {
	font-size: 16px;
	font-weight: 600;
	border-radius: 8px;
}

.detail-title {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.detail-header-actions {
	display: flex;
	gap: 8px;
	flex-shrink: 0;
}

.detail-body {
	flex: 1;
	min-height: 0;
}

.server-detail-panel .connection-method-option {
	display: flex;
	align-items: center;
}

.server-detail-panel .connection-method-radio {
	flex: 1;
	min-width: 0;
}

.server-detail-panel .connection-method-radio :deep(.el-radio-button) {
	flex: 1;
}

.server-detail-panel .connection-method-radio :deep(.el-radio-button__inner) {
	width: 100%;
}

.server-detail-panel .setting-option-input {
	flex: 1;
	min-width: 0;
}

.server-detail-panel .setting-option-input :deep(.el-input) {
	width: 100%;
}

.server-detail-panel .setting-option-input :deep(.el-input__wrapper) {
	border-radius: 12px;
}

.server-detail-panel .setting-option-inputs {
	display: flex;
	align-items: center;
	gap: 10px;
	flex: 1;
	min-width: 0;
}

.server-detail-panel .setting-option-inputs :deep(.el-input) {
	flex: 1;
	min-width: 0;
}

.server-detail-panel .setting-option-inputs :deep(.el-input__wrapper) {
	border-radius: 12px;
}

.server-detail-panel .setting-option-add .setting-option-inputs,
.server-detail-panel .setting-option-env-row .setting-option-inputs {
	flex-wrap: wrap;
}

.server-detail-panel .option-title--muted {
	color: var(--sidebar-border);
	font-size: 13px;
}

.server-detail-panel .setting-option-inputs .el-button.is-circle {
	padding: 8px;
	flex-shrink: 0;
}

.server-detail-panel .setting-option-inputs .el-button .iconfont {
	font-size: 14px;
}

.env-empty-hint {
	justify-content: center;
}

.server-id-info {
	font-size: 12px;
	color: var(--el-text-color-placeholder);
	font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
	padding: 8px 0;
	text-align: center;
}

.cloud-project-item.active {
	background-color: var(--el-fill-color-light);
	border-left: 3px solid var(--el-color-primary-light-5);
}

.cloud-context-toolbar {
	padding: 8px 10px 12px;
	margin: 0 3px 10px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.cloud-context-row {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
	flex-wrap: wrap;
}

.cloud-context-row:last-child {
	margin-bottom: 0;
}

.cloud-context-label {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	flex-shrink: 0;
}

.cloud-current-project-select {
	flex: 1;
	min-width: 120px;
	max-width: 220px;
}

.section-header-actions {
	display: inline-flex;
	align-items: center;
	gap: 2px;
}
</style>
