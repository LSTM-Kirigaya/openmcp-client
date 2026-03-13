/**
 * 用户认证状态管理
 * Vue 3 Composition API 风格的 store
 */

import { ref, computed } from 'vue';
import * as authApi from '../api/auth.js';

export interface UserProfile {
    id: string;
    email: string;
    username?: string;
    avatar_url?: string;
    created_at?: string;
    updated_at?: string;
}

// 状态
const isInitialized = ref(false);
const isConfigured = ref(false);
const isLoggedIn = ref(false);
const user = ref<UserProfile | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

// 计算属性
export const useAuthStore = () => {
    const isAuthenticated = computed(() => isLoggedIn.value && user.value !== null);
    const userDisplayName = computed(() => {
        if (!user.value) return '';
        return user.value.username || user.value.email.split('@')[0];
    });

    /**
     * 初始化认证状态
     */
    async function initialize() {
        if (isInitialized.value) return;

        isLoading.value = true;
        error.value = null;

        try {
            const status = await authApi.getAuthStatus();
            isConfigured.value = status.isConfigured;
            isLoggedIn.value = status.isLoggedIn;
            user.value = status.user;
            isInitialized.value = true;
        } catch (err) {
            error.value = (err as Error).message;
            console.error('[AuthStore] Initialize failed:', err);
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * 登录
     */
    async function login(email: string, password: string): Promise<boolean> {
        isLoading.value = true;
        error.value = null;

        try {
            const result = await authApi.login({ email, password });
            if (result.success && result.user) {
                isLoggedIn.value = true;
                user.value = result.user;
                return true;
            } else {
                error.value = result.error || 'Login failed';
                return false;
            }
        } catch (err) {
            error.value = (err as Error).message;
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * 注册
     */
    async function register(email: string, password: string, username?: string): Promise<boolean> {
        isLoading.value = true;
        error.value = null;

        try {
            const result = await authApi.register({ email, password, username });
            if (result.success && result.user) {
                isLoggedIn.value = true;
                user.value = result.user;
                return true;
            } else {
                error.value = result.error || 'Registration failed';
                return false;
            }
        } catch (err) {
            error.value = (err as Error).message;
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * 登出
     */
    async function logout(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await authApi.logout();
            isLoggedIn.value = false;
            user.value = null;
        } catch (err) {
            error.value = (err as Error).message;
            console.error('[AuthStore] Logout failed:', err);
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * 刷新用户信息
     */
    async function refreshUserInfo(): Promise<void> {
        try {
            const result = await authApi.getCurrentUser();
            isLoggedIn.value = result.isLoggedIn;
            user.value = result.user;
        } catch (err) {
            console.error('[AuthStore] Refresh user info failed:', err);
        }
    }

    /**
     * 更新用户资料
     */
    async function updateProfile(updates: { username?: string; avatar_url?: string }): Promise<boolean> {
        isLoading.value = true;
        error.value = null;

        try {
            const result = await authApi.updateProfile(updates);
            if (result.success && result.user) {
                user.value = result.user;
                return true;
            } else {
                error.value = result.error || 'Update failed';
                return false;
            }
        } catch (err) {
            error.value = (err as Error).message;
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * 清除错误
     */
    function clearError() {
        error.value = null;
    }

    return {
        // 状态
        isInitialized,
        isConfigured,
        isLoggedIn,
        user,
        isLoading,
        error,
        // 计算属性
        isAuthenticated,
        userDisplayName,
        // 方法
        initialize,
        login,
        register,
        logout,
        refreshUserInfo,
        updateProfile,
        clearError
    };
};

// 导出单例状态（用于全局共享）
export const authStore = useAuthStore();
