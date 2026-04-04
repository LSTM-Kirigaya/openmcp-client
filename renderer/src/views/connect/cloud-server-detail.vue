<template>
	<div class="cloud-server-detail">
		<div class="cloud-detail-centered">
			<div class="detail-header">
				<div class="detail-title-wrapper">
					<el-input
						v-model="connForm.name"
						:placeholder="t('server-name-placeholder')"
						class="detail-title-input"
					/>
				</div>
				<div class="detail-header-actions">
					<el-button type="success" :loading="saving" @click="saveProject">{{ t('save') }}</el-button>
					<el-button
						type="primary"
						:loading="connectLoading"
						:disabled="!props.project.enabled"
						@click="emitConnectPayload"
					>{{ t('connect') }}</el-button>
					<el-button type="danger" plain :loading="deleting" @click="confirmDelete">{{ t('delete') }}</el-button>
				</div>
			</div>
			<el-scrollbar class="detail-body">
				<div class="cloud-detail-scroll-inner">
					<div class="connection-setting-content cloud-detail-body server-detail-panel">
				<div class="setting-section">
					<h2>{{ t('connection-settings') }}</h2>
					<div class="setting-options">
						<div class="setting-option connection-method-option">
							<span class="option-title">{{ t('connection-type') }}</span>
							<el-radio-group
								v-model="connForm.connectionType"
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
						<template v-if="connForm.connectionType === 'STDIO'">
							<div class="setting-option">
								<span class="option-title">{{ t('command') }}</span>
								<div class="setting-option-input">
									<el-input
										v-model="connForm.cmdText"
										:placeholder="t('server-command-placeholder')"
									/>
								</div>
							</div>
							<div class="setting-option">
								<span class="option-title">{{ t('cwd') }}</span>
								<div class="setting-option-input">
									<el-input
										v-model="connForm.cwd"
										:placeholder="t('server-cwd-placeholder')"
									/>
								</div>
							</div>
						</template>
						<template v-else>
							<div class="setting-option">
								<span class="option-title">URL</span>
								<div class="setting-option-input">
									<el-input v-model="connForm.url" placeholder="http://" />
								</div>
							</div>
							<div class="setting-option">
								<span class="option-title">OAuth</span>
								<div class="setting-option-input">
									<el-input v-model="connForm.oauth" placeholder="" />
								</div>
							</div>
						</template>
					</div>
				</div>
				<div class="setting-section connection-env-section">
					<h2>{{ t('env-var') }}</h2>
					<p class="cloud-env-hint">{{ t('cloud-env-not-synced') }}</p>
					<div class="setting-options">
						<div class="setting-option setting-option-add">
							<span class="option-title">{{ t('add-env-var') }}</span>
							<div class="setting-option-inputs">
								<el-input v-model="newEnvKey" :placeholder="t('key')" @keyup.enter="addConnEnvItem" />
								<el-input v-model="newEnvValue" :placeholder="t('value')" @keyup.enter="addConnEnvItem" />
								<el-button type="primary" circle @click="addConnEnvItem">
									<span class="iconfont icon-add"></span>
								</el-button>
							</div>
						</div>
						<div
							v-for="(envItem, idx) in connForm.envList"
							:key="idx"
							class="setting-option setting-option-env-row"
						>
							<span class="option-title option-title--muted">{{ envItem.key || t('key') }}</span>
							<div class="setting-option-inputs">
								<el-input v-model="envItem.key" :placeholder="t('key')" />
								<el-input v-model="envItem.value" type="password" show-password :placeholder="t('value')" />
								<el-button type="danger" circle @click="connForm.envList.splice(idx, 1)">
									<span class="iconfont icon-delete"></span>
								</el-button>
							</div>
						</div>
						<div v-if="connForm.envList.length === 0" class="setting-option env-empty-hint">
							<span class="option-title option-title--muted">{{ t('no-env-vars') }}</span>
						</div>
					</div>
				</div>
				<div class="setting-section">
					<h2>{{ t('description') }}</h2>
					<div class="setting-options">
						<div class="setting-option">
							<div class="setting-option-input">
								<el-input v-model="connForm.description" type="textarea" :rows="2" />
							</div>
						</div>
					</div>
				</div>

				<div class="setting-section">
					<h2>{{ t('cloud-project-members-title') }}</h2>
					<div class="setting-options flat-options">
						<div class="setting-option member-add-row">
							<el-input v-model="addMemberUserId" :placeholder="t('cloud-member-user-id-placeholder')" class="member-id-input" />
							<el-select v-model="addMemberRole" style="width: 140px;">
								<el-option v-for="r in memberRoles" :key="r" :label="r" :value="r" />
							</el-select>
							<el-button type="primary" :loading="addingMember" @click="addMember">{{ t('cloud-member-add') }}</el-button>
							<el-button :loading="membersLoading" @click="loadMembers">{{ t('refresh') }}</el-button>
						</div>
					</div>
					<el-table :data="members" border size="small" class="collab-table" v-loading="membersLoading">
						<el-table-column :label="t('cloud-member-user')" min-width="160">
							<template #default="{ row }">
								{{ memberDisplay(row) }}
							</template>
						</el-table-column>
						<el-table-column :label="t('cloud-member-role')" width="140">
							<template #default="{ row }">
								<el-select
									:model-value="row.role"
									size="small"
									@change="handleMemberRoleChange(row, $event)"
								>
									<el-option v-for="r in memberRoles" :key="r" :label="r" :value="r" />
								</el-select>
							</template>
						</el-table-column>
						<el-table-column :label="t('operation-setting')" width="100" fixed="right">
							<template #default="{ row }">
								<el-button
									v-if="memberRowCanRemove(row)"
									size="small"
									type="danger"
									link
									@click="removeMember(row)"
								>{{ t('delete') }}</el-button>
							</template>
						</el-table-column>
					</el-table>
				</div>

				<div class="setting-section">
					<h2>{{ t('cloud-project-invites-title') }}</h2>
					<div class="setting-options flat-options">
						<div class="setting-option invite-actions-row">
							<el-button type="primary" @click="openInviteDialog">{{ t('cloud-invite-create') }}</el-button>
							<el-button :loading="invitesLoading" @click="loadInvites">{{ t('refresh') }}</el-button>
						</div>
					</div>
					<el-table :data="invites" border size="small" class="collab-table collab-table--invites" v-loading="invitesLoading">
						<el-table-column :label="t('cloud-invite-code')" min-width="220" class-name="invite-code-column">
							<template #default="{ row }">
								<div class="invite-code-cell">
									<div class="invite-code-block" :title="row.invite_code">
										<code class="invite-code">{{ row.invite_code }}</code>
									</div>
									<div class="invite-code-actions">
										<el-button
											type="primary"
											plain
											size="small"
											:icon="CopyDocument"
											@click="copyCode(row.invite_code)"
										>
											{{ t('cloud-invite-copy') }}
										</el-button>
									</div>
								</div>
							</template>
						</el-table-column>
						<el-table-column prop="role" :label="t('cloud-member-role')" width="100" />
						<el-table-column :label="t('cloud-invite-uses')" width="100">
							<template #default="{ row }">
								{{ row.use_count ?? 0 }} / {{ row.max_uses ?? '∞' }}
							</template>
						</el-table-column>
						<el-table-column :label="t('cloud-invite-status')" width="100">
							<template #default="{ row }">
								<el-tag v-if="row.is_revoked" type="info" size="small">{{ t('cloud-invite-revoked') }}</el-tag>
								<el-tag v-else type="success" size="small">{{ t('cloud-invite-active') }}</el-tag>
							</template>
						</el-table-column>
						<el-table-column :label="t('operation-setting')" width="160" fixed="right">
							<template #default="{ row }">
								<el-button size="small" link :disabled="row.is_revoked" @click="revokeInvite(row)">{{ t('cloud-invite-revoke') }}</el-button>
								<el-button size="small" type="danger" link @click="deleteInvite(row)">{{ t('delete') }}</el-button>
							</template>
						</el-table-column>
					</el-table>
				</div>
					</div>
				</div>
			</el-scrollbar>
		</div>

		<el-dialog v-model="inviteDialogVisible" :title="t('cloud-invite-create')" width="440px" @closed="resetInviteForm">
			<el-form label-position="top">
				<el-form-item :label="t('cloud-member-role')" required>
					<el-select v-model="inviteForm.role" style="width: 100%;">
						<el-option v-for="r in inviteRoles" :key="r" :label="r" :value="r" />
					</el-select>
				</el-form-item>
				<el-form-item :label="t('cloud-invite-max-uses')">
					<el-input-number v-model="inviteForm.maxUses" :min="1" :max="9999" controls-position="right" style="width: 100%;" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="inviteDialogVisible = false">{{ t('cancel') }}</el-button>
				<el-button type="primary" :loading="inviteCreating" @click="submitInvite">{{ t('confirm') }}</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CopyDocument } from '@element-plus/icons-vue';
import { cloudAuthState } from '@/hook/cloud-auth';
import {
	cloudAddProjectMember,
	cloudCreateProjectInvite,
	cloudDeleteProject,
	cloudDeleteProjectInvite,
	cloudListProjectInvites,
	cloudListProjectMembers,
	cloudRemoveProjectMember,
	cloudRevokeProjectInvite,
	cloudUpdateProject,
	cloudUpdateProjectMemberRole,
	type CloudProject,
	type CloudProjectInvite,
	type CloudProjectMember
} from '@/api/cloud';
import { connectionSelectDataViewOption } from './core';
import {
	cloudProjectToConnectionForm,
	connectionFormToCloudWritePayload,
	createEmptyMcpConnectionForm,
	validateMcpConnectionForm,
	type McpConnectionFormState
} from './mcp-connection-form-map';

defineComponent({ name: 'CloudServerDetail' });

const props = withDefaults(
	defineProps<{
		project: CloudProject;
		connectLoading?: boolean;
	}>(),
	{ connectLoading: false }
);

const emit = defineEmits<{
	(e: 'refresh-list'): void;
	(e: 'connect', project: CloudProject): void;
	(e: 'deleted'): void;
}>();

const { t } = useI18n();

const memberRoles = ['owner', 'writer', 'reader'] as const;
const inviteRoles = ['writer', 'reader'] as const;

const connForm = ref<McpConnectionFormState>(createEmptyMcpConnectionForm());
const newEnvKey = ref('');
const newEnvValue = ref('');

const saving = ref(false);
const deleting = ref(false);

const connectLoading = computed(() => props.connectLoading);

const members = ref<CloudProjectMember[]>([]);
const membersLoading = ref(false);
const addMemberUserId = ref('');
const addMemberRole = ref<string>('writer');
const addingMember = ref(false);

const currentCloudUserId = computed(() => cloudAuthState.user?.id ?? '');

const isCurrentUserCloudProjectOwner = computed(() => {
	const uid = currentCloudUserId.value;
	if (!uid) return false;
	return members.value.some(m => m.user_id === uid && m.role === 'owner');
});

function memberRowCanRemove(row: CloudProjectMember): boolean {
	if (!isCurrentUserCloudProjectOwner.value) return false;
	if (row.role === 'owner') return false;
	if (row.user_id === currentCloudUserId.value) return false;
	return true;
}

const invites = ref<CloudProjectInvite[]>([]);
const invitesLoading = ref(false);
const inviteDialogVisible = ref(false);
const inviteForm = ref({ role: 'writer' as string, maxUses: undefined as number | undefined });
const inviteCreating = ref(false);

function syncFormFromProject(p: CloudProject) {
	connForm.value = cloudProjectToConnectionForm(p);
	newEnvKey.value = '';
	newEnvValue.value = '';
}

function addConnEnvItem() {
	const key = newEnvKey.value.trim();
	const value = newEnvValue.value;
	if (!key) return;
	const existing = connForm.value.envList.find(e => e.key === key);
	if (existing) {
		existing.value = value;
	} else {
		connForm.value.envList.push({ key, value });
	}
	newEnvKey.value = '';
	newEnvValue.value = '';
}

watch(
	() => props.project,
	p => {
		syncFormFromProject(p);
		loadMembers();
		loadInvites();
	},
	{ immediate: true }
);

function memberDisplay(row: CloudProjectMember) {
	const u = row.user;
	if (u?.username) {
		return u.email ? `${u.username} (${u.email})` : u.username;
	}
	return row.user_id;
}

async function loadMembers() {
	membersLoading.value = true;
	try {
		members.value = await cloudListProjectMembers(props.project.id);
	} catch (err: any) {
		ElMessage.error(err?.message || t('cloud-member-load-failed'));
		members.value = [];
	} finally {
		membersLoading.value = false;
	}
}

async function loadInvites() {
	invitesLoading.value = true;
	try {
		invites.value = await cloudListProjectInvites(props.project.id);
	} catch (err: any) {
		ElMessage.error(err?.message || t('cloud-invite-load-failed'));
		invites.value = [];
	} finally {
		invitesLoading.value = false;
	}
}

async function saveProject() {
	const errKey = validateMcpConnectionForm(connForm.value);
	if (errKey) {
		ElMessage.warning(t(errKey));
		return;
	}
	const payload = connectionFormToCloudWritePayload(connForm.value, {
		enabled: props.project.enabled
	});
	saving.value = true;
	try {
		await cloudUpdateProject(props.project.id, {
			name: payload.name,
			transport: payload.transport,
			endpoint: payload.endpoint,
			description: payload.description,
			enabled: payload.enabled
		});
		ElMessage.success(t('cloud-project-updated'));
		emit('refresh-list');
	} catch (err: any) {
		ElMessage.error(err?.message || t('error'));
	} finally {
		saving.value = false;
	}
}

async function confirmDelete() {
	try {
		await ElMessageBox.confirm(`${t('delete')}「${props.project.name}」?`, t('confirm'), {
			type: 'warning',
			confirmButtonText: t('confirm'),
			cancelButtonText: t('cancel')
		});
	} catch {
		return;
	}
	deleting.value = true;
	try {
		await cloudDeleteProject(props.project.id);
		ElMessage.success(t('cloud-project-deleted'));
		emit('deleted');
		emit('refresh-list');
	} catch (err: any) {
		ElMessage.error(err?.message || t('error'));
	} finally {
		deleting.value = false;
	}
}

function emitConnectPayload() {
	const errKey = validateMcpConnectionForm(connForm.value);
	if (errKey) {
		ElMessage.warning(t(errKey));
		return;
	}
	const w = connectionFormToCloudWritePayload(connForm.value, {
		enabled: props.project.enabled
	});
	const p: CloudProject = {
		...props.project,
		name: w.name,
		transport: w.transport,
		endpoint: w.endpoint,
		description: w.description ?? '',
		enabled: w.enabled
	};
	emit('connect', p);
}

async function addMember() {
	const uid = addMemberUserId.value.trim();
	if (!uid) {
		ElMessage.warning(t('cloud-member-user-id-placeholder'));
		return;
	}
	addingMember.value = true;
	try {
		await cloudAddProjectMember(props.project.id, uid, addMemberRole.value);
		ElMessage.success(t('cloud-member-added'));
		addMemberUserId.value = '';
		await loadMembers();
	} catch (err: any) {
		ElMessage.error(err?.message || t('cloud-member-add-failed'));
	} finally {
		addingMember.value = false;
	}
}

function handleMemberRoleChange(row: CloudProjectMember, value: unknown) {
	void updateMemberRole(row, String(value));
}

async function updateMemberRole(row: CloudProjectMember, role: string) {
	try {
		await cloudUpdateProjectMemberRole(props.project.id, row.user_id, role);
		ElMessage.success(t('cloud-member-role-updated'));
		await loadMembers();
	} catch (err: any) {
		ElMessage.error(err?.message || t('error'));
		await loadMembers();
	}
}

async function removeMember(row: CloudProjectMember) {
	try {
		await ElMessageBox.confirm(t('cloud-member-remove-confirm'), t('confirm'), {
			type: 'warning',
			confirmButtonText: t('confirm'),
			cancelButtonText: t('cancel')
		});
	} catch {
		return;
	}
	try {
		await cloudRemoveProjectMember(props.project.id, row.user_id);
		ElMessage.success(t('cloud-member-removed'));
		await loadMembers();
	} catch (err: any) {
		ElMessage.error(err?.message || t('error'));
	}
}

function openInviteDialog() {
	inviteForm.value = { role: 'writer', maxUses: undefined };
	inviteDialogVisible.value = true;
}

function resetInviteForm() {
	inviteForm.value = { role: 'writer', maxUses: undefined };
}

async function submitInvite() {
	inviteCreating.value = true;
	try {
		const maxUses = inviteForm.value.maxUses;
		await cloudCreateProjectInvite(props.project.id, {
			role: inviteForm.value.role,
			maxUses: typeof maxUses === 'number' ? maxUses : undefined
		});
		ElMessage.success(t('cloud-invite-created'));
		inviteDialogVisible.value = false;
		await loadInvites();
	} catch (err: any) {
		ElMessage.error(err?.message || t('cloud-invite-create-failed'));
	} finally {
		inviteCreating.value = false;
	}
}

async function copyCode(code: string) {
	try {
		await navigator.clipboard.writeText(code);
		ElMessage.success(t('cloud-invite-copied'));
	} catch {
		ElMessage.warning(t('cloud-invite-copy-failed'));
	}
}

async function revokeInvite(row: CloudProjectInvite) {
	try {
		await cloudRevokeProjectInvite(props.project.id, row.id);
		ElMessage.success(t('cloud-invite-revoked-ok'));
		await loadInvites();
	} catch (err: any) {
		ElMessage.error(err?.message || t('error'));
	}
}

async function deleteInvite(row: CloudProjectInvite) {
	try {
		await ElMessageBox.confirm(t('cloud-invite-delete-confirm'), t('confirm'), {
			type: 'warning',
			confirmButtonText: t('confirm'),
			cancelButtonText: t('cancel')
		});
	} catch {
		return;
	}
	try {
		await cloudDeleteProjectInvite(props.project.id, row.id);
		ElMessage.success(t('cloud-invite-deleted'));
		await loadInvites();
	} catch (err: any) {
		ElMessage.error(err?.message || t('error'));
	}
}
</script>

<style scoped>
.cloud-server-detail {
	display: flex;
	flex-direction: column;
	align-items: center;
	height: 100%;
	overflow: hidden;
	width: 100%;
}

.cloud-detail-centered {
	flex: 1;
	min-height: 0;
	width: 100%;
	max-width: 720px;
	margin: 0 auto;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
}

.cloud-detail-scroll-inner {
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 0 16px 24px;
	box-sizing: border-box;
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

.cloud-env-hint {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	margin: 0 0 10px 0;
	line-height: 1.4;
	padding: 0 4px;
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

.detail-header-actions {
	display: flex;
	gap: 8px;
	flex-shrink: 0;
}

.detail-body {
	flex: 1;
	min-height: 0;
	width: 100%;
}

.detail-body :deep(.el-scrollbar__view) {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.cloud-detail-body {
	width: 100%;
	max-width: 100%;
	box-sizing: border-box;
}

.flat-options .setting-option {
	border-radius: 16px !important;
	margin-bottom: 8px;
}

.member-add-row {
	flex-wrap: wrap;
	gap: 8px !important;
}

.member-id-input {
	flex: 1;
	min-width: 160px;
}

.invite-actions-row {
	justify-content: flex-start !important;
	gap: 8px !important;
}

.collab-table {
	width: 100%;
	margin: 12px auto 0;
}

.collab-table--invites :deep(.el-table__cell) {
	vertical-align: middle;
}

/* 表格单元格默认 nowrap，会撑出整表横向滚动条；邀请码列允许换行 */
.collab-table--invites :deep(td.invite-code-column .cell) {
	white-space: normal;
	word-break: break-word;
	overflow-wrap: anywhere;
}

.invite-code-cell {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 8px;
	min-width: 0;
	width: 100%;
}

.invite-code-block {
	padding: 6px 10px;
	border-radius: 8px;
	background: var(--el-fill-color-light);
	border: 1px solid var(--el-border-color-lighter);
	min-width: 0;
	overflow: hidden;
}

.invite-code {
	display: block;
	margin: 0;
	font-size: 12px;
	line-height: 1.45;
	font-family: var(--el-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
	user-select: all;
	white-space: normal;
	word-break: break-all;
	overflow-wrap: anywhere;
}

.invite-code-actions {
	display: flex;
	justify-content: flex-start;
}

.cloud-detail-body :deep(.setting-section) {
	width: 100%;
	max-width: 100%;
	margin-left: auto;
	margin-right: auto;
}
</style>
