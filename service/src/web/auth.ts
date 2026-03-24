import axios from 'axios';

const DEV_BASE_URL = 'http://localhost:8000';
const PROD_BASE_URL = 'https://openmcp.peacesheep.xyz';

/**
 * 获取 API Base URL
 * 支持通过环境变量 OPENMCP_API_BASE_URL 配置
 */
function getBaseUrl(): string {
    if (process.env.OPENMCP_API_BASE_URL) {
        return process.env.OPENMCP_API_BASE_URL;
    }
    return process.env.NODE_ENV === 'development' ? DEV_BASE_URL : PROD_BASE_URL;
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

function createOAuthAxiosInstance() {
    const baseURL = getBaseUrl();
    return axios.create({
        baseURL,
        timeout: 10000,
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

export interface OAuthAuthorizeResponse {
    channel: string;
    authUrl: string;
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

function extractAuthUrl(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const candidates = [
        payload.authUrl,
        payload.authorizationUrl,
        payload.authorizeUrl,
        payload.url,
        payload.loginUrl,
        payload.data?.authUrl,
        payload.data?.authorizationUrl,
        payload.data?.authorizeUrl,
        payload.data?.url,
        payload.data?.loginUrl
    ];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }
    return null;
}

/**
 * 获取 OAuth 授权链接
 * 优先调用 /api/auth/oauth/{channel}，并兼容常见返回字段名。
 */
export async function getOAuthAuthorizeUrl(channel: string, redirectUri?: string): Promise<OAuthAuthorizeResponse> {
    const client = createOAuthAxiosInstance();
    const safeChannel = String(channel || '').trim();
    if (!safeChannel) {
        throw new Error('OAuth channel is required');
    }

    const query = redirectUri ? { redirectUri } : {};
    const body = redirectUri ? { channel: safeChannel, redirectUri } : { channel: safeChannel };
    const requests = [
        () => client.get(`/api/auth/oauth/${encodeURIComponent(safeChannel)}`, { params: query }),
        () => client.get('/api/auth/oauth', { params: { channel: safeChannel, ...query } }),
        () => client.post(`/api/auth/oauth/${encodeURIComponent(safeChannel)}`, redirectUri ? { redirectUri } : {}),
        () => client.post('/api/auth/oauth', body)
    ];

    let lastError: any;
    for (const request of requests) {
        try {
            const response = await request();
            const authUrl = extractAuthUrl(response.data);
            if (!authUrl) {
                throw new Error('OAuth authUrl not found in response');
            }
            return {
                channel: safeChannel,
                authUrl
            };
        } catch (error: any) {
            lastError = error;
        }
    }

    if (lastError) {
        throw lastError;
    }
    throw new Error('Failed to fetch OAuth authorize URL');
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
