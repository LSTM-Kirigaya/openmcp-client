/**
 * 用户认证服务
 * 处理登录、注册、登出、Token 刷新等逻辑
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createClient, SupabaseClient, AuthError, User } from '@supabase/supabase-js';
import { AuthResponse, AuthState, LoginRequest, RegisterRequest, UpdateProfileRequest, UserProfile } from './auth.dto.js';

// Supabase 配置 - 等待用户填入
const SUPABASE_URL = process.env['SUPABASE_URL'] || '';
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'] || '';

// 本地认证状态存储路径
const AUTH_STATE_FILE = path.join(os.homedir(), '.openmcp', 'auth_state.json');

class AuthService {
    private supabase: SupabaseClient | null = null;
    private state: AuthState = {
        isLoggedIn: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null
    };

    constructor() {
        this.loadState();
        this.initSupabase();
    }

    private initSupabase() {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.warn('[AuthService] Supabase credentials not configured');
            return;
        }

        try {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: false, // 我们自己管理 session
                }
            });
            console.log('[AuthService] Supabase client initialized');
        } catch (error) {
            console.error('[AuthService] Failed to initialize Supabase:', error);
        }
    }

    /**
     * 从本地加载认证状态
     */
    private loadState(): void {
        try {
            if (fs.existsSync(AUTH_STATE_FILE)) {
                const data = fs.readFileSync(AUTH_STATE_FILE, 'utf-8');
                this.state = JSON.parse(data);
                console.log('[AuthService] Auth state loaded from local storage');
            }
        } catch (error) {
            console.error('[AuthService] Failed to load auth state:', error);
        }
    }

    /**
     * 保存认证状态到本地
     */
    private saveState(): void {
        try {
            const dir = path.dirname(AUTH_STATE_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('[AuthService] Failed to save auth state:', error);
        }
    }

    /**
     * 清除本地认证状态
     */
    private clearState(): void {
        this.state = {
            isLoggedIn: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null
        };
        try {
            if (fs.existsSync(AUTH_STATE_FILE)) {
                fs.unlinkSync(AUTH_STATE_FILE);
            }
        } catch (error) {
            console.error('[AuthService] Failed to clear auth state:', error);
        }
    }

    /**
     * 将 Supabase User 转换为 UserProfile
     */
    private mapUserToProfile(user: User): UserProfile {
        return {
            id: user.id,
            email: user.email || '',
            username: user.user_metadata?.['username'] || user.email?.split('@')[0] || '',
            avatar_url: user.user_metadata?.['avatar_url'],
            created_at: user.created_at,
            updated_at: user.updated_at
        };
    }

    /**
     * 检查 Supabase 是否已配置
     */
    isConfigured(): boolean {
        return this.supabase !== null;
    }

    /**
     * 获取当前认证状态
     */
    getState(): AuthState {
        // 检查 token 是否过期
        if (this.state.expiresAt && Date.now() >= this.state.expiresAt * 1000) {
            // Token 过期，尝试刷新
            this.refreshSession();
        }
        return { ...this.state };
    }

    /**
     * 用户注册
     */
    async register(request: RegisterRequest): Promise<AuthResponse> {
        if (!this.supabase) {
            throw new Error('Supabase not configured');
        }

        const { email, password, username } = request;

        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username || email.split('@')[0]
                }
            }
        });

        if (error) {
            throw new Error(`Registration failed: ${error.message}`);
        }

        if (!data.user) {
            throw new Error('Registration failed: No user returned');
        }

        // 更新本地状态
        this.state = {
            isLoggedIn: true,
            user: this.mapUserToProfile(data.user),
            accessToken: data.session?.access_token || null,
            refreshToken: data.session?.refresh_token || null,
            expiresAt: data.session?.expires_at || null
        };
        this.saveState();

        return {
            user: this.state.user,
            session: data.session ? {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at
            } : null
        };
    }

    /**
     * 用户登录
     */
    async login(request: LoginRequest): Promise<AuthResponse> {
        if (!this.supabase) {
            throw new Error('Supabase not configured');
        }

        const { email, password } = request;

        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw new Error(`Login failed: ${error.message}`);
        }

        if (!data.user) {
            throw new Error('Login failed: No user returned');
        }

        if (!data.session) {
            throw new Error('Login failed: No session returned');
        }

        const session = data.session;

        // 更新本地状态
        this.state = {
            isLoggedIn: true,
            user: this.mapUserToProfile(data.user),
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at ?? null
        };
        this.saveState();

        return {
            user: this.state.user,
            session: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at
            }
        };
    }

    /**
     * 用户登出
     */
    async logout(): Promise<void> {
        if (this.supabase) {
            await this.supabase.auth.signOut();
        }
        this.clearState();
    }

    /**
     * 刷新 Session
     */
    async refreshSession(): Promise<AuthResponse> {
        if (!this.supabase) {
            throw new Error('Supabase not configured');
        }

        if (!this.state.refreshToken) {
            throw new Error('No refresh token available');
        }

        const { data, error } = await this.supabase.auth.refreshSession({
            refresh_token: this.state.refreshToken
        });

        if (error) {
            // 刷新失败，清除状态
            this.clearState();
            throw new Error(`Session refresh failed: ${error.message}`);
        }

        if (!data.user) {
            this.clearState();
            throw new Error('Session refresh failed: No user returned');
        }

        if (!data.session) {
            this.clearState();
            throw new Error('Session refresh failed: No session returned');
        }

        const session = data.session;

        // 更新本地状态
        this.state = {
            isLoggedIn: true,
            user: this.mapUserToProfile(data.user),
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at ?? null
        };
        this.saveState();

        return {
            user: this.state.user,
            session: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at
            }
        };
    }

    /**
     * 更新用户资料
     */
    async updateProfile(request: UpdateProfileRequest): Promise<UserProfile> {
        if (!this.supabase) {
            throw new Error('Supabase not configured');
        }

        if (!this.state.isLoggedIn) {
            throw new Error('Not logged in');
        }

        const { data, error } = await this.supabase.auth.updateUser({
            data: request
        });

        if (error) {
            throw new Error(`Update profile failed: ${error.message}`);
        }

        const profile = this.mapUserToProfile(data.user);
        this.state.user = profile;
        this.saveState();

        return profile;
    }

    /**
     * 获取当前用户信息
     */
    async getCurrentUser(): Promise<UserProfile | null> {
        if (!this.supabase) {
            return this.state.user;
        }

        const { data, error } = await this.supabase.auth.getUser();

        if (error || !data.user) {
            return null;
        }

        return this.mapUserToProfile(data.user);
    }

    /**
     * 获取 Access Token（用于云备份请求）
     */
    getAccessToken(): string | null {
        return this.state.accessToken;
    }
}

// 导出单例实例
export const authService = new AuthService();
