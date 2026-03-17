import axios from 'axios';

// 默认 base URL，可以被环境变量覆盖
const DEFAULT_BASE_URL = 'http://localhost:8000';

/**
 * 获取 API Base URL
 * 支持通过环境变量 OPENMCP_API_BASE_URL 配置
 */
function getBaseUrl(): string {
    return process.env.OPENMCP_API_BASE_URL || DEFAULT_BASE_URL;
}

/**
 * 创建 axios 实例
 */
function createAxiosInstance() {
    const baseURL = getBaseUrl();
    return axios.create({
        baseURL,
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

// Token 存储（内存中）
let storedToken: string | null = null;

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: {
        id: string;
        username: string;
        email?: string;
    };
    expiresAt: string;
}

export interface AuthStatusResponse {
    loggedIn: boolean;
    username?: string;
    expiresAt?: string;
}

/**
 * 登录
 * POST /api/auth/login
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
    const client = createAxiosInstance();
    
    const response = await client.post<LoginResponse>('/api/auth/login', {
        username,
        password
    });
    
    if (response.data.token) {
        storedToken = response.data.token;
    }
    
    return response.data;
}

/**
 * 登出
 * POST /api/auth/logout
 */
export async function logout(): Promise<void> {
    const client = createAxiosInstance();
    
    // 如果有 token，添加到请求头
    if (storedToken) {
        client.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    
    await client.post('/api/auth/logout');
    storedToken = null;
}

/**
 * 检查认证状态
 * GET /api/auth/status
 */
export async function checkAuthStatus(): Promise<AuthStatusResponse> {
    const client = createAxiosInstance();
    
    // 如果有 token，添加到请求头
    if (storedToken) {
        client.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    
    const response = await client.get<AuthStatusResponse>('/api/auth/status');
    return response.data;
}

/**
 * 刷新 Token
 * POST /api/auth/refresh
 */
export async function refreshToken(): Promise<LoginResponse> {
    const client = createAxiosInstance();
    
    if (!storedToken) {
        throw new Error('No token to refresh');
    }
    
    client.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    
    const response = await client.post<LoginResponse>('/api/auth/refresh');
    
    if (response.data.token) {
        storedToken = response.data.token;
    }
    
    return response.data;
}

/**
 * 设置 Token（用于从外部加载已保存的 token）
 */
export function setToken(token: string): void {
    storedToken = token;
}

/**
 * 获取当前 Token
 */
export function getToken(): string | null {
    return storedToken;
}

/**
 * 清除 Token
 */
export function clearToken(): void {
    storedToken = null;
}

/**
 * 检查是否已登录
 */
export function isLoggedIn(): boolean {
    return storedToken !== null;
}
