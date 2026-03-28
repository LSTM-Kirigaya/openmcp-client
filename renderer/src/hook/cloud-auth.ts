import { computed, reactive } from 'vue';
import { cloudLogin, cloudLogout, cloudRefresh, cloudRegister, type CloudTokenPair, type CloudUser } from '@/api/cloud';
import { registerCloudAccessTokenGetter } from '@/api/cloud-http';

const CLOUD_AUTH_STORAGE_KEY = 'openmcp.cloud.auth';

interface CloudAuthPersist {
    user: CloudUser | null;
    tokens: CloudTokenPair | null;
}

interface CloudAuthState {
    user: CloudUser | null;
    tokens: CloudTokenPair | null;
    loading: boolean;
    ready: boolean;
}

export const cloudAuthState = reactive<CloudAuthState>({
    user: null,
    tokens: null,
    loading: false,
    ready: false
});

export const isCloudLoggedIn = computed(() => Boolean(cloudAuthState.tokens?.access_token));

function persistCloudAuth() {
    const data: CloudAuthPersist = {
        user: cloudAuthState.user,
        tokens: cloudAuthState.tokens
    };
    localStorage.setItem(CLOUD_AUTH_STORAGE_KEY, JSON.stringify(data));
}

function clearPersistedCloudAuth() {
    localStorage.removeItem(CLOUD_AUTH_STORAGE_KEY);
}

export function hydrateCloudAuth() {
    if (cloudAuthState.ready) {
        return;
    }
    const raw = localStorage.getItem(CLOUD_AUTH_STORAGE_KEY);
    if (raw) {
        try {
            const data = JSON.parse(raw) as CloudAuthPersist;
            cloudAuthState.user = data.user ?? null;
            cloudAuthState.tokens = data.tokens ?? null;
        } catch {
            clearPersistedCloudAuth();
        }
    }
    cloudAuthState.ready = true;
}

export async function cloudAccountLogin(identifier: string, password: string) {
    cloudAuthState.loading = true;
    try {
        const result = await cloudLogin(identifier, password);
        setCloudSession(result.user, result.tokens);
        return result.user;
    } finally {
        cloudAuthState.loading = false;
    }
}

export async function cloudAccountRegister(email: string, username: string, password: string) {
    cloudAuthState.loading = true;
    try {
        const result = await cloudRegister(email, username, password);
        setCloudSession(result.user, result.tokens);
        return result.user;
    } finally {
        cloudAuthState.loading = false;
    }
}

export async function cloudAccountRefresh() {
    const refreshToken = cloudAuthState.tokens?.refresh_token;
    if (!refreshToken) {
        return null;
    }
    const tokens = await cloudRefresh(refreshToken);
    cloudAuthState.tokens = tokens;
    persistCloudAuth();
    return tokens;
}

export async function cloudAccountLogout() {
    const refreshToken = cloudAuthState.tokens?.refresh_token;
    if (refreshToken) {
        try {
            await cloudLogout(refreshToken);
        } catch {
            // Ignore remote logout failure and clear local state.
        }
    }
    cloudAuthState.user = null;
    cloudAuthState.tokens = null;
    clearPersistedCloudAuth();
}

export function setCloudSession(user: CloudUser, tokens: CloudTokenPair) {
    cloudAuthState.user = user;
    cloudAuthState.tokens = tokens;
    persistCloudAuth();
}

registerCloudAccessTokenGetter(() => cloudAuthState.tokens?.access_token);
