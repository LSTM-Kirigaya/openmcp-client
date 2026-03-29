import { createApiClient, createOAuthClient } from './http-client.js';
import {
  clearToken as clearTokenStore,
  getExpiresAt,
  getRefreshToken,
  getToken as getAccessToken,
  getUser,
  isLoggedIn as isLoggedInStore,
  setToken as setTokenAccessOnly,
  setTokenPair,
  setUser,
  type StoredUser
} from './token-store.js';

export interface LoginRequest {
  username: string; // 对应后端 identifier（邮箱或用户名）
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string; // access_token
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
  user?: {
    id?: string;
    username?: string;
    email?: string;
  };
  subscriptionTier?: string;
  expiresAt?: string;
}

export interface OAuthAuthorizeResponse {
  channel: string;
  authUrl: string;
}

export interface DeviceStartResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

type BackendCommonResponse<T = any> = {
  code: number;
  message: string;
  data: T;
};

type BackendTokens = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number | string;
};

type BackendLoginResponse = BackendCommonResponse<{
  user: StoredUser & { id?: string; username?: string; email?: string };
  tokens: BackendTokens;
}>;

type BackendDeviceStartResponse = BackendCommonResponse<{
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}>;

type BackendDeviceTokenResponse = BackendCommonResponse<{
  user: StoredUser & { id?: string; username?: string; email?: string };
  tokens: BackendTokens;
}>;

type BackendMeProfileResponse = BackendCommonResponse<{
  id?: string;
  username?: string;
  email?: string;
}>;

type BackendMeSubscriptionResponse = BackendCommonResponse<{
  plan?: {
    code?: string;
    name?: string;
  };
}>;

function decodeJwtUserFromAccessToken(token: string | null): StoredUser | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = Buffer.from(normalized + padding, 'base64').toString('utf8');
    const payload = JSON.parse(json) as {
      uid?: string;
      username?: string;
      email?: string;
    };
    if (!payload.uid && !payload.username && !payload.email) {
      return null;
    }
    return {
      id: payload.uid,
      username: payload.username,
      email: payload.email
    };
  } catch {
    return null;
  }
}

function mapBackendLogin(resp: BackendLoginResponse): LoginResponse {
  const tokens = resp.data.tokens;
  const user = resp.data.user;

  // 映射到 service 现有 controller 输出结构：token/user/expiresAt
  setTokenPair({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    user: {
      id: (user as any).id,
      username: (user as any).username,
      email: (user as any).email
    },
    ...(tokens.expires_in !== undefined ? { expiresIn: tokens.expires_in } : {})
  });

  const expires = getExpiresAt();
  return {
    token: tokens.access_token,
    user: {
      id: String((user as any).id ?? ''),
      username: String((user as any).username ?? ''),
      email: (user as any).email
    },
    expiresAt: expires ?? new Date().toISOString()
  };
}

/**
 * 登录
 * 后端：POST /api/v1/auth/login
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const client = createApiClient();
  const resp = await client.post<BackendLoginResponse>('/auth/login', {
    identifier: username,
    password
  });

  return mapBackendLogin(resp.data);
}

/**
 * 注册
 * 后端：POST /api/v1/auth/register
 */
export async function register(email: string, username: string, password: string): Promise<LoginResponse> {
  const client = createApiClient();
  const resp = await client.post<BackendLoginResponse>('/auth/register', {
    email,
    username,
    password
  });
  return mapBackendLogin(resp.data);
}

/**
 * 登出
 * 后端：POST /api/v1/auth/logout
 * 注意：需要 Authorization + body.refresh_token
 */
export async function logout(): Promise<void> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (!accessToken || !refreshToken) {
    // 没法完成后端登出时仍保持“本地清理”的体验
    clearToken();
    return;
  }

  const client = createApiClient();
  await client.post('/auth/logout', {
    refresh_token: refreshToken
  });

  clearToken();
}

/**
 * 登出所有设备
 * 后端：POST /api/v1/auth/logout-all
 */
export async function logoutAll(): Promise<void> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    clearToken();
    return;
  }
  const client = createApiClient();
  await client.post('/auth/logout-all', {});
  clearToken();
}

/**
 * 检查认证状态
 * 后端当前没有 /auth/status；这里做本地状态判断，避免 404。
 */
export async function checkAuthStatus(): Promise<AuthStatusResponse> {
  const loggedIn = isLoggedInStore();
  let user = getUser();
  let subscriptionTier: string | undefined;

  if (loggedIn) {
    const client = createApiClient();
    const needRemoteUser = !user || (!user.id && !user.username && !user.email);

    if (needRemoteUser) {
      try {
        const profileResp = await client.get<BackendMeProfileResponse>('/me/profile');
        const profile = profileResp.data?.data;
        if (profile && (profile.id || profile.username || profile.email)) {
          user = {
            id: profile.id,
            username: profile.username,
            email: profile.email
          };
          setUser(user);
        }
      } catch {
        // ignore: 仍然返回本地登录态
      }
    }

    // 最后兜底：从 access token claims 解析用户信息（uid/username/email）
    if (!user || (!user.id && !user.username && !user.email)) {
      const decoded = decodeJwtUserFromAccessToken(getAccessToken());
      if (decoded) {
        user = decoded;
        setUser(decoded);
      }
    }

    try {
      const subResp = await client.get<BackendMeSubscriptionResponse>('/me/subscription');
      const plan = subResp.data?.data?.plan;
      subscriptionTier = plan?.name || plan?.code || undefined;
    } catch {
      // ignore: 订阅接口失败不影响登录态
    }
  }

  return {
    loggedIn,
    username: user?.username,
    user: user
      ? {
          id: user.id,
          username: user.username,
          email: user.email
        }
      : undefined,
    subscriptionTier,
    expiresAt: getExpiresAt() ?? undefined
  };
}

/**
 * 刷新 Token
 * 后端：POST /api/v1/auth/refresh
 * 注意：后端要求 body.refresh_token；JWT 中间件会对 /auth/refresh 放行。
 */
export async function refreshToken(): Promise<LoginResponse> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token to refresh');
  }

  // refresh 由后端 body 驱动；Authorization 这里也无害
  const client = createApiClient();
  const resp = await client.post<BackendLoginResponse>('/auth/refresh', {
    refresh_token: refreshToken
  });

  // 后端 refresh 返回 data.tokens，不包含 user 字段；为了兼容 controller 输出结构，user 取已缓存的 user 或空。
  const tokens = resp.data.data.tokens;
  setTokenPair({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in
  });

  // 后端 refresh 不返回 user；但 token-store 里会保留上次 login 的 user 信息
  const userStore = getUser();

  return {
    token: tokens.access_token,
    user: {
      id: String(userStore?.id ?? ''),
      username: String(userStore?.username ?? ''),
      email: userStore?.email
    },
    expiresAt: getExpiresAt() ?? new Date().toISOString()
  };
}

/**
 * 获取 OAuth 授权链接
 * 后端：GET /api/v1/auth/oauth/:provider
 * 返回：{ code, message, data: { url: "..." } }
 */
export async function getOAuthAuthorizeUrl(
  channel: string,
  redirectUri?: string
): Promise<OAuthAuthorizeResponse> {
  const safeChannel = String(channel || '').trim();
  if (!safeChannel) {
    throw new Error('OAuth channel is required');
  }

  const client = createOAuthClient();

  const resp = await client.get<BackendCommonResponse<{ url: string }>>(
    `/auth/oauth/${encodeURIComponent(safeChannel)}`,
    redirectUri ? { params: { redirectUri } } : undefined
  );

  const authUrl = resp.data.data.url;
  if (typeof authUrl !== 'string' || !authUrl.trim()) {
    throw new Error('OAuth authUrl not found in response');
  }

  return {
    channel: safeChannel,
    authUrl
  };
}

/**
 * 设置 Token（用于从外部加载已保存的 token）
 * 这里仍兼容旧用法：仅设置 access_token（refresh/logout 可能因此不可用）。
 */
export function setToken(token: string): void {
  setTokenAccessOnly(token);
}

/**
 * 获取当前 Token（access_token）
 */
export function getToken(): string | null {
  return getAccessToken();
}

/**
 * 清除 Token（access/refresh/expires/user）
 */
export function clearToken(): void {
  clearTokenStore();
}

/**
 * 检查是否已登录（access_token 是否存在）
 */
export function isLoggedIn(): boolean {
  return isLoggedInStore();
}

/**
 * 从外部直接写入 token（例如 CLI OAuth 自动保存后）
 * 这里尽量不依赖 expires_in：token-store 会从 JWT exp 推断 expiresAt。
 */
export function setTokenPairFromExternal(params: {
  accessToken: string;
  refreshToken: string;
  user?: StoredUser | null;
}): void {
  setTokenPair({
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    user: params.user ?? null
  });
}

/**
 * OAuth nonce finalize：
 * 后端完成 code->token 之后，302 跳转到 CLI 本地页面（只带 nonce），
 * CLI 再调用本方法把 tokens 写入 token-store。
 *
 * 后端：GET /api/v1/auth/oauth/tokens?nonce=...
 */
export async function oauthFinalizeByNonce(nonce: string): Promise<LoginResponse> {
  // 换 nonce 时不应附带旧的 Authorization，避免连错环境或干扰排查；该路由本身也不校验 JWT。
  const client = createOAuthClient();
  const resp = await client.get<BackendCommonResponse<{
    user: StoredUser & { id?: string; username?: string; email?: string };
    tokens: BackendTokens;
  }>>('/auth/oauth/tokens', {
    params: { nonce }
  });

  const data = resp.data.data;
  const mappedUser = {
    id: (data.user as any).id,
    username: (data.user as any).username,
    email: (data.user as any).email
  };

  setTokenPair({
    accessToken: data.tokens.access_token,
    refreshToken: data.tokens.refresh_token,
    user: mappedUser
  });

  return {
    token: data.tokens.access_token,
    user: {
      id: String((mappedUser as any).id ?? ''),
      username: String((mappedUser as any).username ?? ''),
      email: (mappedUser as any).email
    },
    expiresAt: getExpiresAt() ?? new Date().toISOString()
  };
}

/**
 * Device Code Flow start
 * 后端：POST /api/v1/auth/device/start
 */
export async function startDeviceAuth(channel: string): Promise<DeviceStartResponse> {
  const client = createApiClient();
  const resp = await client.post<BackendDeviceStartResponse>('/auth/device/start', {
    channel
  });

  const d = resp.data.data;
  return {
    deviceCode: d.device_code,
    userCode: d.user_code,
    verificationUri: d.verification_uri,
    verificationUriComplete: d.verification_uri_complete,
    expiresIn: d.expires_in,
    interval: d.interval
  };
}

/**
 * Device Code Flow poll
 * 后端：POST /api/v1/auth/device/token
 */
export async function pollDeviceToken(deviceCode: string): Promise<LoginResponse> {
  const client = createApiClient();
  const resp = await client.post<BackendDeviceTokenResponse>('/auth/device/token', {
    device_code: deviceCode
  });

  // 后端 pending 阶段返回 202 + authorization_pending
  if (resp.status === 202 || (resp.data as any)?.code === 42001) {
    const err: any = new Error((resp.data as any)?.message || 'authorization_pending');
    err.response = {
      status: 202,
      data: {
        message: (resp.data as any)?.message || 'authorization_pending'
      }
    };
    throw err;
  }

  const d = resp.data.data;
  if (!d?.tokens) {
    throw new Error('Device token response missing tokens');
  }
  const tokens = d.tokens;
  const user = d.user;

  setTokenPairFromExternal({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    user: {
      id: (user as any).id,
      username: (user as any).username,
      email: (user as any).email
    }
  });

  return {
    token: tokens.access_token,
    user: {
      id: String((user as any).id ?? ''),
      username: String((user as any).username ?? ''),
      email: (user as any).email
    },
    expiresAt: getExpiresAt() ?? new Date().toISOString()
  };
}
