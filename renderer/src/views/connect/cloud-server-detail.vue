<template>
	<div class="cloud-server-detail">
		<div class="detail-header">
			<h3 class="detail-title">{{ form.name || t('unnamed-server') }}</h3>
			<div class="detail-header-actions">
				<el-button type="success" :loading="saving" @click="saveProject">{{ t('save') }}</el-button>
				<el-button
					type="primary"
					:loading="connectLoading"
					:disabled="!form.enabled"
					@click="emitConnectPayload"
				>{{ t('connect') }}</el-button>
				<el-button type="danger" plain :loading="deleting" @click="confirmDelete">{{ t('delete') }}</el-button>
			</div>
		</div>
		<el-scrollbar class="detail-body">
			<div class="connection-setting-content cloud-detail-body">
				<div class="setting-section">
					<h2>{{ t('cloud-project-settings-section') }}</h2>
					<div class="setting-options">
						<div class="setting-option">
							<span class="option-title">{{ t('cloud-project-name') }}</span>
							<div class="setting-option-input">
								<el-input v-model="form.name" />
							</div>
						</div>
						<div class="setting-option">
							<span class="option-title">{{ t('connection-type') }}</span>
							<el-select v-model="form.transport" style="width: 100%;">
								<el-option label="streamable_http" value="http" />
								<el-option label="sse" value="sse" />
								<el-option label="stdio" value="stdio" />
							</el-select>
						</div>
						<div class="setting-option">
							<span class="option-title">{{ t('cloud-project-endpoint') }}</span>
							<div class="setting-option-input">
								<el-input v-model="form.endpoint" />
							</div>
						</div>
						<div class="setting-option">
							<span class="option-title">{{ t('description') }}</span>
							<div class="setting-option-input">
								<el-input v-model="form.description" type="textarea" :rows="2" />
							</div>
						</div>
						<div class="setting-option">
							<span class="option-title">{{ t('status') }}</span>
							<el-switch v-model="form.enabled" />
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
									@change="(v) => updateMemberRole(row, String(v))"
								>
									<el-option v-for="r in memberRoles" :key="r" :label="r" :value="r" />
								</el-select>
							</template>
						</el-table-column>
						<el-table-column :label="t('operation-setting')" width="100" fixed="right">
							<template #default="{ row }">
								<el-button size="small" type="danger" link @click="removeMember(row)">{{ t('delete') }}</el-button>
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
					<el-table :data="invites" border size="small" class="collab-table" v-loading="invitesLoading">
						<el-table-column :label="t('cloud-invite-code')" min-width="200">
							<template #default="{ row }">
								<code class="invite-code">{{ row.invite_code }}</code>
								<el-button size="small" link @click="copyCode(row.invite_code)">{{ t('cloud-invite-copy') }}</el-button>
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
		</el-scrollbar>

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

const form = ref({
	name: '',
	transport: 'http' as 'stdio' | 'sse' | 'http',
	endpoint: '',
	description: '',
	enabled: true
});

const saving = ref(false);
const deleting = ref(false);

const connectLoading = computed(() => props.connectLoading);

const members = ref<CloudProjectMember[]>([]);
const membersLoading = ref(false);
const addMemberUserId = ref('');
const addMemberRole = ref<string>('writer');
const addingMember = ref(false);

const invites = ref<CloudProjectInvite[]>([]);
const invitesLoading = ref(false);
const inviteDialogVisible = ref(false);
const inviteForm = ref({ role: 'writer' as string, maxUses: undefined as number | undefined });
const inviteCreating = ref(false);

function syncFormFromProject(p: CloudProject) {
	form.value = {
		name: p.name,
		transport: p.transport,
		endpoint: p.endpoint,
		description: p.description || '',
		enabled: p.enabled
	};
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
	if (!form.value.name?.trim() || !form.value.transport || !form.value.endpoint?.trim()) {
		ElMessage.warning(t('cloud-project-required'));
		return;
	}
	saving.value = true;
	try {
		await cloudUpdateProject(props.project.id, {
			name: form.value.name.trim(),
			transport: form.value.transport,
			endpoint: form.value.endpoint.trim(),
			description: form.value.description,
			enabled: form.value.enabled
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
	const p: CloudProject = {
		...props.project,
		name: form.value.name.trim() || props.project.name,
		transport: form.value.transport,
		endpoint: form.value.endpoint.trim(),
		description: form.value.description,
		enabled: form.value.enabled
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

.cloud-detail-body {
	width: 100%;
	max-width: 720px;
	align-self: center;
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
	margin-top: 12px;
}

.invite-code {
	font-size: 12px;
	margin-right: 8px;
	user-select: all;
}

.cloud-detail-body :deep(.setting-section) {
	width: min(720px, 100%);
}
</style>
