<template>
    <div class="setting-section">
        <h2>{{ t('cloud-account-title') }}</h2>
        <div class="setting-options" v-if="!isCloudLoggedIn">
            <div class="setting-option">
                <span class="option-title">{{ t('cloud-auth-mode') }}</span>
                <el-segmented v-model="authMode" :options="authModes" />
            </div>
            <div class="setting-option">
                <span class="option-title">{{ authMode === 'login' ? t('cloud-identifier') : t('cloud-register-email') }}</span>
                <div style="width: 260px;">
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
                <div style="width: 260px;">
                    <el-input v-model="registerUsername" :placeholder="t('cloud-register-username-placeholder')" />
                </div>
            </div>
            <div class="setting-option">
                <span class="option-title">{{ t('cloud-password') }}</span>
                <div style="width: 260px;">
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
                <span>{{ cloudAuthState.user?.username }} ({{ cloudAuthState.user?.email }})</span>
            </div>
            <div class="setting-option">
                <span class="option-title">{{ t('cloud-token-status') }}</span>
                <span>{{ t('cloud-token-valid') }}</span>
            </div>
            <div class="setting-option actions">
                <el-button @click="handleRefresh">{{ t('cloud-refresh-token') }}</el-button>
                <el-button type="danger" @click="handleLogout">{{ t('cloud-logout') }}</el-button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { cloudExchangeOAuthNonce, cloudGetOAuthUrl } from '@/api/cloud';
import {
    cloudAccountLogin,
    cloudAccountLogout,
    cloudAccountRefresh,
    cloudAccountRegister,
    cloudAuthState,
    isCloudLoggedIn,
    setCloudSession
} from '@/hook/cloud-auth';

defineComponent({ name: 'CloudAccountSetting' });

const { t } = useI18n();
const authMode = ref<'login' | 'register'>('login');
const identifier = ref('');
const registerEmail = ref('');
const registerUsername = ref('');
const password = ref('');
const authModes = computed(() => [
    { label: t('cloud-auth-mode-login'), value: 'login' },
    { label: t('cloud-auth-mode-register'), value: 'register' }
]);

async function handleLogin() {
    if (!identifier.value || !password.value) {
        ElMessage.warning(t('cloud-login-required'));
        return;
    }
    try {
        await cloudAccountLogin(identifier.value, password.value);
        password.value = '';
        ElMessage.success(t('cloud-login-success'));
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
        setCloudSession(result.user, result.tokens);
        ElMessage.success(t('cloud-login-success'));
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
    ElMessage.success(t('cloud-logout-success'));
}
</script>

<style scoped>
.actions {
    justify-content: flex-end;
}
</style>
