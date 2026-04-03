<template>
    <div class="setting-section cloud-account-section">
        <h2>{{ t('cloud-account-title') }}</h2>
        <div class="setting-options" v-if="!isCloudLoggedIn">
            <div class="setting-option">
                <span class="option-title">{{ t('cloud-auth-mode') }}</span>
                <el-segmented v-model="authMode" :options="authModes" />
            </div>
            <div class="setting-option">
                <span class="option-title">{{ authMode === 'login' ? t('cloud-identifier') : t('cloud-register-email') }}</span>
                <div style="width: 320px;">
                    <el-input
                        v-if="authMode === 'login'"
                        v-model="identifier"
                        :placeholder="t('cloud-identifier-placeholder')"
                    />
                    <el-input
                        v-else
                        v-model="registerEmail"
                        :placeholder="t('cloud-register-email-placeholder')"
                    />
                </div>
            </div>
            <div v-if="authMode === 'register'" class="setting-option">
                <span class="option-title">{{ t('cloud-register-username') }}</span>
                <div style="width: 320px;">
                    <el-input v-model="registerUsername" :placeholder="t('cloud-register-username-placeholder')" />
                </div>
            </div>
            <div class="setting-option">
                <span class="option-title">{{ t('cloud-password') }}</span>
                <div style="width: 320px;">
                    <el-input v-model="password" type="password" show-password :placeholder="t('cloud-password-placeholder')" />
                </div>
            </div>
            <div class="setting-option actions">
                <el-button
                    type="primary"
                    :loading="cloudAuthState.loading"
                    @click="authMode === 'login' ? handleLogin() : handleRegister()"
                >
                    {{ authMode === 'login' ? t('cloud-login') : t('cloud-register') }}
                </el-button>
                <el-button
                    v-if="authMode === 'login'"
                    :loading="cloudAuthState.loading"
                    @click="handleGithubLogin"
                >
                    {{ t('cloud-login-github') }}
                </el-button>
            </div>
        </div>

        <div class="setting-options" v-else>
            <div class="setting-option">
                <span class="option-title">{{ t('cloud-current-user') }}</span>
                <span>{{ currentUserDisplay }}</span>
            </div>
            <div class="setting-option">
                <span class="option-title">{{ t('cloud-token-status') }}</span>
                <span>{{ t('cloud-token-valid') }}</span>
            </div>
            <div class="setting-option">
                <span class="option-title">{{ t('cloud-subscription-level') }}</span>
                <span>{{ cloudAuthState.subscriptionTier || t('cloud-subscription-unknown') }}</span>
            </div>
            <div class="setting-option">
                <span class="subscription-notice">{{ t('cloud-subscription-free-only') }}</span>
            </div>
            <div class="setting-option actions">
                <el-button @click="handleRefresh">{{ t('cloud-refresh-token') }}</el-button>
                <el-button type="danger" @click="handleLogout">{{ t('cloud-logout') }}</el-button>
            </div>
        </div>

        <h2 class="project-title">{{ t('cloud-projects-title') }}</h2>
        <div class="setting-options">
            <div class="setting-option">
                <span class="option-title">{{ t('runtime-mode') }}</span>
                <el-segmented
                    :model-value="cloudContext.mode"
                    :options="modeOptions"
                    @change="handleModeChange"
                />
            </div>
            <div class="setting-option" v-if="cloudContext.mode === 'cloud'">
                <span class="option-title">{{ t('cloud-current-project') }}</span>
                <div style="width: 320px;">
                    <el-select
                        :model-value="cloudContext.currentProjectId"
                        :placeholder="t('cloud-select-project')"
                        style="width: 100%;"
                        @change="setCurrentCloudProject"
                    >
                        <el-option
                            v-for="item in projects"
                            :key="item.id"
                            :label="item.name"
                            :value="item.id"
                        />
                    </el-select>
                </div>
            </div>
            <div class="setting-option actions">
                <el-button :disabled="!isCloudLoggedIn" @click="loadProjects">
                    {{ t('refresh') }}
                </el-button>
                <el-button type="primary" :disabled="!isCloudLoggedIn" @click="openCreateDialog">
                    {{ t('add') }}
                </el-button>
            </div>
        </div>

        <el-table :data="projects" border size="small" class="project-table">
            <el-table-column prop="name" :label="t('cloud-project-name')" width="220" />
            <el-table-column :label="t('connection-type')" width="170">
                <template #default="{ row }">
                    {{ formatTransport(row.transport) }}
                </template>
            </el-table-column>
            <el-table-column prop="endpoint" :label="t('cloud-project-endpoint')" min-width="380" show-overflow-tooltip />
            <el-table-column prop="enabled" :label="t('status')" width="90">
                <template #default="{ row }">
                    <el-tag :type="row.enabled ? 'success' : 'info'">
                        {{ row.enabled ? t('enabled') : t('disabled') }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column :label="t('operation-setting')" width="130" fixed="right">
                <template #default="{ row }">
                    <div class="project-op-actions">
                        <el-button size="small" class="project-op-btn" @click="openEditDialog(row)">{{ t('edit') }}</el-button>
                        <el-button size="small" class="project-op-btn danger" @click="removeProject(row)">{{ t('delete') }}</el-button>
                    </div>
                </template>
            </el-table-column>
        </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? t('edit') : t('add')" width="520px">
        <el-form :model="form" label-position="top">
            <el-form-item :label="t('cloud-project-name')" required>
                <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item :label="t('connection-type')" required>
                <el-select v-model="form.transport" style="width: 100%;">
                    <el-option label="streamable_http" value="http" />
                    <el-option label="sse" value="sse" />
                    <el-option label="stdio" value="stdio" />
                </el-select>
            </el-form-item>
            <el-form-item :label="t('cloud-project-endpoint')" required>
                <el-input v-model="form.endpoint" />
            </el-form-item>
            <el-form-item :label="t('description')">
                <el-input v-model="form.description" type="textarea" />
            </el-form-item>
            <el-form-item :label="t('status')">
                <el-switch v-model="form.enabled" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="dialogVisible = false">{{ t('cancel') }}</el-button>
            <el-button type="primary" @click="submitProject">{{ t('save') }}</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
    cloudCreateProject,
    cloudDeleteProject,
    cloudExchangeOAuthNonce,
    cloudGetOAuthUrl,
    cloudListProjects,
    cloudUpdateProject,
    type CloudProject
} from '@/api/cloud';
import {
    cloudAccountLogin,
    cloudAccountLogout,
    cloudAccountRefresh,
    cloudAccountRegister,
    cloudAuthState,
    isCloudLoggedIn,
    refreshCloudAuthStatus,
    setCloudSession
} from '@/hook/cloud-auth';
import { cloudContext, setCurrentCloudProject, setRuntimeMode } from '@/hook/cloud-context';

defineComponent({ name: 'CloudAccountSetting' });

const { t } = useI18n();
const authMode = ref<'login' | 'register'>('login');
const identifier = ref('');
const registerEmail = ref('');
const registerUsername = ref('');
const password = ref('');
const projects = ref<CloudProject[]>([]);
const dialogVisible = ref(false);
const editingId = ref('');
const form = ref({
    name: '',
    transport: 'http' as 'stdio' | 'sse' | 'http',
    endpoint: '',
    description: '',
    enabled: true
});

const authModes = computed(() => [
    { label: t('cloud-auth-mode-login'), value: 'login' },
    { label: t('cloud-auth-mode-register'), value: 'register' }
]);

const modeOptions = computed(() => [
    { label: t('runtime-mode-local'), value: 'local' },
    { label: t('runtime-mode-cloud'), value: 'cloud' }
]);

const currentUserDisplay = computed(() => {
    const user = cloudAuthState.user;
    if (!user) {
        return '-';
    }
    if (user.email) {
        return `${user.username} (${user.email})`;
    }
    return user.username || '-';
});

function formatTransport(transport: 'stdio' | 'sse' | 'http'): string {
    if (transport === 'http') return 'streamable_http';
    return transport;
}

function handleModeChange(value: unknown) {
    if (value === 'cloud' || value === 'local') {
        setRuntimeMode(value);
    }
}

async function loadProjects() {
    if (!isCloudLoggedIn.value) {
        projects.value = [];
        return;
    }
    try {
        projects.value = await cloudListProjects();
        if (!projects.value.some(item => item.id === cloudContext.currentProjectId)) {
            setCurrentCloudProject(projects.value[0]?.id || '');
        }
    } catch (err: any) {
        ElMessage.error(err?.message || t('cloud-load-projects-failed'));
    }
}

function openCreateDialog() {
    editingId.value = '';
    form.value = {
        name: '',
        transport: 'http',
        endpoint: '',
        description: '',
        enabled: true
    };
    dialogVisible.value = true;
}

function openEditDialog(project: CloudProject) {
    editingId.value = project.id;
    form.value = {
        name: project.name,
        transport: project.transport,
        endpoint: project.endpoint,
        description: project.description || '',
        enabled: project.enabled
    };
    dialogVisible.value = true;
}

async function submitProject() {
    if (!form.value.name || !form.value.transport || !form.value.endpoint) {
        ElMessage.warning(t('cloud-project-required'));
        return;
    }
    try {
        if (editingId.value) {
            await cloudUpdateProject(editingId.value, form.value);
            ElMessage.success(t('cloud-project-updated'));
        } else {
            const created = await cloudCreateProject(form.value);
            ElMessage.success(t('cloud-project-created'));
            if (!cloudContext.currentProjectId) {
                setCurrentCloudProject(created.id);
            }
        }
        dialogVisible.value = false;
        await loadProjects();
    } catch (err: any) {
        ElMessage.error(err?.message || t('error'));
    }
}

async function removeProject(project: CloudProject) {
    try {
        await ElMessageBox.confirm(
            `${t('delete')} "${project.name}" ?`,
            t('confirm'),
            {
                type: 'warning',
                confirmButtonText: t('confirm'),
                cancelButtonText: t('cancel')
            }
        );
        await cloudDeleteProject(project.id);
        if (cloudContext.currentProjectId === project.id) {
            setCurrentCloudProject('');
        }
        ElMessage.success(t('cloud-project-deleted'));
        await loadProjects();
    } catch (err: any) {
        if (err === 'cancel' || err === 'close') {
            return;
        }
        ElMessage.error(err?.message || t('error'));
    }
}

async function handleLogin() {
    if (!identifier.value || !password.value) {
        ElMessage.warning(t('cloud-login-required'));
        return;
    }
    try {
        await cloudAccountLogin(identifier.value, password.value);
        password.value = '';
        ElMessage.success(t('cloud-login-success'));
        await loadProjects();
    } catch (err: any) {
        ElMessage.error(err?.message || t('cloud-login-failed'));
    }
}

async function handleRegister() {
    if (!registerEmail.value || !registerUsername.value || !password.value) {
        ElMessage.warning(t('cloud-register-required'));
        return;
    }
    try {
        await cloudAccountRegister(registerEmail.value, registerUsername.value, password.value);
        password.value = '';
        ElMessage.success(t('cloud-register-success'));
        await loadProjects();
    } catch (err: any) {
        ElMessage.error(err?.message || t('cloud-register-failed'));
    }
}

function randomState(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function waitForOAuthNonce(popup: Window): Promise<string> {
    const startedAt = Date.now();
    return await new Promise<string>((resolve, reject) => {
        const timer = window.setInterval(() => {
            if (popup.closed) {
                window.clearInterval(timer);
                reject(new Error(t('cloud-oauth-cancelled')));
                return;
            }
            if (Date.now() - startedAt > 2 * 60 * 1000) {
                window.clearInterval(timer);
                popup.close();
                reject(new Error(t('cloud-oauth-timeout')));
                return;
            }
            try {
                if (!popup.location.href.startsWith(window.location.origin)) {
                    return;
                }
                const nonce = new URL(popup.location.href).searchParams.get('nonce');
                if (nonce) {
                    window.clearInterval(timer);
                    popup.close();
                    resolve(nonce);
                }
            } catch {
                // Ignore cross-origin errors before OAuth redirects back.
            }
        }, 500);
    });
}

async function handleGithubLogin() {
    cloudAuthState.loading = true;
    try {
        const redirectUri = `${window.location.origin}${window.location.pathname}`;
        const url = await cloudGetOAuthUrl('github', redirectUri, randomState());
        const popup = window.open(url, 'openmcp_github_oauth', 'width=760,height=780');
        if (!popup) {
            throw new Error(t('cloud-oauth-popup-blocked'));
        }
        const nonce = await waitForOAuthNonce(popup);
        const result = await cloudExchangeOAuthNonce(nonce);
        setCloudSession(result.user);
        ElMessage.success(t('cloud-login-success'));
        await loadProjects();
    } catch (err: any) {
        ElMessage.error(err?.message || t('cloud-oauth-failed'));
    } finally {
        cloudAuthState.loading = false;
    }
}

async function handleRefresh() {
    try {
        await cloudAccountRefresh();
        ElMessage.success(t('cloud-refresh-success'));
    } catch (err: any) {
        ElMessage.error(err?.message || t('cloud-refresh-failed'));
    }
}

async function handleLogout() {
    await cloudAccountLogout();
    projects.value = [];
    ElMessage.success(t('cloud-logout-success'));
}

onMounted(async () => {
    await refreshCloudAuthStatus();
    await loadProjects();
});
</script>

<style scoped>
.cloud-account-section {
    width: min(1100px, 96%);
}

.project-title {
    margin-top: 24px;
}

.actions {
    justify-content: flex-end;
}

.project-table {
    margin-top: 14px;
}

.project-table :deep(.el-table__cell) {
    white-space: nowrap;
}

.project-op-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.project-op-btn {
    min-width: 54px;
}

.project-op-btn.danger {
    color: var(--el-color-danger);
    border-color: var(--el-color-danger-light-5);
}

.subscription-notice {
    font-size: 13px;
    color: var(--el-color-warning);
    padding: 4px 0;
}
</style>
