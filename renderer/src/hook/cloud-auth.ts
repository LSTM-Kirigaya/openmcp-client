import { computed, reactive } from 'vue';
import { cloudAuthStatus, cloudLogin, cloudLogout, cloudRefresh, cloudRegister, type CloudUser } from '@/api/cloud';

interface CloudAuthState {
    user: CloudUser | null;
    loggedIn: boolean;
    subscriptionTier: string | null;
    loading: boolean;
    ready: boolean;
}

export const cloudAuthState = reactive<CloudAuthState>({
    user: null,
    loggedIn: false,
    subscriptionTier: null,
    loading: false,
    ready: false
});

export const isCloudLoggedIn = computed(() => cloudAuthState.loggedIn);

export function hydrateCloudAuth() {
    if (cloudAuthState.ready) {
        return;
    }
    cloudAuthState.ready = true;
    void refreshCloudAuthStatus();
}

export async function refreshCloudAuthStatus() {
    try {
        const status = await cloudAuthStatus();
        console.log('[cloud-auth] auth/status response:', JSON.stringify({
            loggedIn: status.loggedIn,
            subscriptionTier: status.subscriptionTier,
            user: status.user?.username
        }));
        cloudAuthState.loggedIn = Boolean(status.loggedIn);
        cloudAuthState.subscriptionTier = status.subscriptionTier || null;
        if (status.user) {
            cloudAuthState.user = status.user;
        } else if (!status.loggedIn) {
            cloudAuthState.user = null;
        }
    } catch (err) {
        console.warn('[cloud-auth] refreshCloudAuthStatus failed:', err);
        cloudAuthState.loggedIn = false;
        cloudAuthState.user = null;
        cloudAuthState.subscriptionTier = null;
    }
}

export async function cloudAccountLogin(identifier: string, password: string) {
    cloudAuthState.loading = true;
    try {
        const result = await cloudLogin(identifier, password);
        setCloudSession(result.user);
        return result.user;
    } finally {
        cloudAuthState.loading = false;
    }
}

export async function cloudAccountRegister(email: string, username: string, password: string) {
    cloudAuthState.loading = true;
    try {
        const result = await cloudRegister(email, username, password);
        setCloudSession(result.user);
        return result.user;
    } finally {
        cloudAuthState.loading = false;
    }
}

export async function cloudAccountRefresh() {
    await cloudRefresh();
    await refreshCloudAuthStatus();
}

export async function cloudAccountLogout() {
    try {
        await cloudLogout();
    } catch {
        // Ignore remote logout failure and clear local state.
    }
    cloudAuthState.user = null;
    cloudAuthState.loggedIn = false;
    cloudAuthState.subscriptionTier = null;
}

export function setCloudSession(user: CloudUser) {
    cloudAuthState.user = user;
    cloudAuthState.loggedIn = true;
}
