/**
 * 用户认证相关 API
 */

import { sendRequest } from './message-bridge.js';

export interface UserProfile {
    id: string;
    email: string;
    username?: string;
    avatar_url?: string;
    created_at?: string;
    updated_at?: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    username?: string;
}

export interface UpdateProfileRequest {
    username?: string;
    avatar_url?: string;
}

export interface AuthStatus {
    isConfigured: boolean;
    isLoggedIn: boolean;
    user: UserProfile | null;
}

export interface ApiResponse<T> {
    code: number;
    msg: T;
}

/**
 * 获取认证状态
 */
export async function getAuthStatus(): Promise<AuthStatus> {
    const response = await sendRequest<AuthStatus>('auth/status', {});
    return response.msg;
}

/**
 * 用户登录
 */
export async function login(request: LoginRequest): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const response = await sendRequest<{ success: boolean; user: UserProfile; error?: string }>('auth/login', request);
    return response.msg;
}

/**
 * 用户注册
 */
export async function register(request: RegisterRequest): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const response = await sendRequest<{ success: boolean; user: UserProfile; error?: string }>('auth/register', request);
    return response.msg;
}

/**
 * 用户登出
 */
export async function logout(): Promise<{ success: boolean; error?: string }> {
    const response = await sendRequest<{ success: boolean; error?: string }>('auth/logout', {});
    return response.msg;
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<{ isLoggedIn: boolean; user: UserProfile | null }> {
    const response = await sendRequest<{ isLoggedIn: boolean; user: UserProfile | null }>('auth/me', {});
    return response.msg;
}

/**
 * 更新用户资料
 */
export async function updateProfile(request: UpdateProfileRequest): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const response = await sendRequest<{ success: boolean; user: UserProfile; error?: string }>('auth/update-profile', request);
    return response.msg;
}

/**
 * 刷新 Session
 */
export async function refreshSession(): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const response = await sendRequest<{ success: boolean; user: UserProfile; error?: string }>('auth/refresh', {});
    return response.msg;
}
