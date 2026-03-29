import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import {
  getAccessToken,
  getExpiresAt,
  getRefreshToken,
  reloadTokenFromDiskIfEmpty
} from './token-store.js';
import { loadServiceDotEnv } from './load-service-env.js';

const DEV_BASE_URL_RAW = 'http://localhost:8000';
const PROD_BASE_URL_RAW = 'https://openmcp.peacesheep.xyz';

loadServiceDotEnv();

/**
 * 云端 API 基址（优先级从高到低）：
 * 1. OPENMCP_API_BASE_URL 显式指定
 * 2. OPENMCP_APP_ENV=production → 远程；=development → 本地
 * 3. 未设 OPENMCP_APP_ENV 时：NODE_ENV=production（如 yarn build 后的产物）→ 远程；否则默认本地
 */
function getBaseUrlRaw(): string {
  if (process.env.OPENMCP_API_BASE_URL) {
    return String(process.env.OPENMCP_API_BASE_URL);
  }
  const appEnv = (process.env.OPENMCP_APP_ENV || '').trim().toLowerCase();
  if (appEnv === 'production') {
    return PROD_BASE_URL_RAW;
  }
  if (appEnv === 'development') {
    return DEV_BASE_URL_RAW;
  }
  return process.env.NODE_ENV === 'production' ? PROD_BASE_URL_RAW : DEV_BASE_URL_RAW;
}

function normalizeApiBaseUrl(baseRaw: string): string {
  // 兼容用户可能已在环境变量里写了 /api/v1
  const trimmed = String(baseRaw || '').replace(/\/+$/, '');
  if (!trimmed) return trimmed;

  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api/v1/')) return trimmed.replace(/\/+$/, '');
  return `${trimmed}/api/v1`;
}

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

/** 这些路径遇 401 不重试刷新（避免死循环或与业务语义不符） */
const AUTH_NO_REFRESH_PREFIXES = [
  'auth/refresh',
  'auth/login',
  'auth/register',
  'auth/device/start',
  'auth/device/token'
];

function pathKey(config: InternalAxiosRequestConfig): string {
  const u = config.url || '';
  if (u.startsWith('http')) {
    try {
      const pathname = new URL(u).pathname;
      return pathname.replace(/^\/api\/v1\/?/, '').replace(/^\//, '');
    } catch {
      return u;
    }
  }
  return u.replace(/^\//, '');
}

function shouldSkip401Refresh(config: InternalAxiosRequestConfig): boolean {
  const key = pathKey(config);
  return AUTH_NO_REFRESH_PREFIXES.some((p) => key === p || key.startsWith(`${p}/`));
}

function isProactiveRefreshSkippedPath(config: InternalAxiosRequestConfig): boolean {
  const key = pathKey(config);
  return (
    key.startsWith('auth/refresh') ||
    key.startsWith('auth/login') ||
    key.startsWith('auth/register') ||
    key.startsWith('auth/device/start') ||
    key.startsWith('auth/device/token')
  );
}

/** 并发刷新合并为一次，避免多个 401 同时打 refresh */
let refreshInFlight: Promise<void> | null = null;

function ensureAccessTokenRefreshed(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  const p = import('./auth.js')
    .then((mod) => mod.refreshToken())
    .then(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });
  refreshInFlight = p;
  return p;
}

async function maybeProactiveRefresh(config: InternalAxiosRequestConfig): Promise<void> {
  if (isProactiveRefreshSkippedPath(config)) return;
  const rt = getRefreshToken();
  if (!rt) return;
  const expStr = getExpiresAt();
  if (!expStr) return;
  const msLeft = new Date(expStr).getTime() - Date.now();
  // 剩余不足 2 分钟或已过期（时钟轻微偏差允许 30s）则先刷新
  if (msLeft > 120_000) return;
  try {
    await ensureAccessTokenRefreshed();
  } catch {
    // 交给后续请求；若仍无效则由 401 拦截器再试一次或失败
  }
}

function attachAuthInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use(async (config) => {
    reloadTokenFromDiskIfEmpty();
    await maybeProactiveRefresh(config);
    const t = getAccessToken();
    if (t) {
      config.headers.Authorization = `Bearer ${t}`;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const original = error.config as RetryableRequest | undefined;
      const status = error.response?.status;

      if (status !== 401 || !original || original._retry) {
        return Promise.reject(error);
      }
      if (shouldSkip401Refresh(original)) {
        return Promise.reject(error);
      }
      if (!getRefreshToken()) {
        return Promise.reject(error);
      }

      original._retry = true;
      try {
        await ensureAccessTokenRefreshed();
        const next = getAccessToken();
        if (!next) {
          return Promise.reject(error);
        }
        original.headers.Authorization = `Bearer ${next}`;
        return client.request(original);
      } catch {
        return Promise.reject(error);
      }
    }
  );
}

let apiSingleton: AxiosInstance | null = null;

export function createApiClient(): AxiosInstance {
  reloadTokenFromDiskIfEmpty();
  const baseURL = normalizeApiBaseUrl(getBaseUrlRaw());
  if (!apiSingleton) {
    apiSingleton = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    attachAuthInterceptors(apiSingleton);
  } else {
    apiSingleton.defaults.baseURL = baseURL;
  }
  return apiSingleton;
}

export function createOAuthClient(): AxiosInstance {
  const baseURL = normalizeApiBaseUrl(getBaseUrlRaw());

  return axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
