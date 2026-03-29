import axios, { type AxiosInstance } from 'axios';
import { getAccessToken, reloadTokenFromDiskIfEmpty } from './token-store.js';

const DEV_BASE_URL_RAW = 'http://localhost:8000';
const PROD_BASE_URL_RAW = 'https://openmcp.peacesheep.xyz';

function getBaseUrlRaw(): string {
  if (process.env.OPENMCP_API_BASE_URL) {
    return String(process.env.OPENMCP_API_BASE_URL);
  }
  // 仅 development 走本地；未设置 NODE_ENV 或非 development 一律走远程（与 CLI/Gateway 默认联调目标一致）。
  return process.env.NODE_ENV === 'development' ? DEV_BASE_URL_RAW : PROD_BASE_URL_RAW;
}

function normalizeApiBaseUrl(baseRaw: string): string {
  // 兼容用户可能已在环境变量里写了 /api/v1
  const trimmed = String(baseRaw || '').replace(/\/+$/, '');
  if (!trimmed) return trimmed;

  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api/v1/')) return trimmed.replace(/\/+$/, '');
  return `${trimmed}/api/v1`;
}

export function createApiClient(): AxiosInstance {
  reloadTokenFromDiskIfEmpty();
  const baseURL = normalizeApiBaseUrl(getBaseUrlRaw());
  const token = getAccessToken();

  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (token) {
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  return client;
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

