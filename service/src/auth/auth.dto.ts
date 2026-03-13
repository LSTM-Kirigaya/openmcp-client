/**
 * 用户认证相关的 DTO 类型定义
 */

export interface UserProfile {
    id: string;
    email: string;
    username?: string;
    avatar_url?: string;
    created_at?: string;
    updated_at?: string;
}

export interface AuthResponse {
    user: UserProfile | null;
    session: {
        access_token: string;
        refresh_token: string;
        expires_at?: number;
    } | null;
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

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface AuthState {
    isLoggedIn: boolean;
    user: UserProfile | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
}
