import fs from 'fs';
import path from 'path';
import { ensureParentDir, getLegacyTokenFilePath, getTokenFilePath } from '../storage/paths.js';

export interface StoredUser {
  id?: string;
  username?: string;
  email?: string;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let expiresAt: string | null = null;
let user: StoredUser | null = null;
let requiresOnboarding = false;

function getTokenPath(): string {
  return getTokenFilePath();
}

function ensureDirForFile(filePath: string): void {
  ensureParentDir(filePath);
}

function decodeJwtExpIso(token: string): string | null {
  // JWT format: header.payload.signature (payload holds exp as seconds)
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payloadPart = parts[1];
  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = Buffer.from(normalized + padding, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    const ms = payload.exp * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return null;
  } catch {
    return null;
  }
}

function saveToDisk(): void {
  const tokenPath = getTokenPath();
  ensureDirForFile(tokenPath);

  // 保存当前快照：即使 refresh_token 不存在也允许写入，只要 access_token 存在
  const snapshot = {
    accessToken,
    refreshToken,
    expiresAt,
    user,
    requiresOnboarding
  };
  fs.writeFileSync(tokenPath, JSON.stringify(snapshot, null, 2), 'utf8');
}

function loadFromDisk(): void {
  const tokenPath = getTokenPath();
  if (!fs.existsSync(tokenPath)) {
    const legacyPath = getLegacyTokenFilePath();
    if (legacyPath !== tokenPath && fs.existsSync(legacyPath)) {
      ensureParentDir(tokenPath);
      fs.copyFileSync(legacyPath, tokenPath);
    }
  }
  if (!fs.existsSync(tokenPath)) return;
  try {
    const raw = fs.readFileSync(tokenPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      accessToken?: string | null;
      refreshToken?: string | null;
      expiresAt?: string | null;
      user?: StoredUser | null;
      requiresOnboarding?: boolean;
    };
    accessToken = typeof parsed.accessToken === 'string' ? parsed.accessToken : null;
    refreshToken = typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null;
    expiresAt = typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null;
    user = parsed.user ?? null;
    requiresOnboarding = parsed.requiresOnboarding === true;

    // 如果 expiresAt 不存在但 accessToken 有效，就从 JWT exp 推断
    if (accessToken && (!expiresAt || expiresAt === null)) {
      const inferred = decodeJwtExpIso(accessToken);
      if (inferred) expiresAt = inferred;
    }
  } catch {
    // ignore: 本地文件损坏不应阻断进程
  }
}

function clearDisk(): void {
  const tokenPath = getTokenPath();
  try {
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
  } catch {
    // ignore
  }
}

// 模块加载时先尝试从磁盘恢复
loadFromDisk();

/** 进程内内存未持有 access token 时再从磁盘拉取（例如 Gateway 重启后、OAuth 由其他进程写过文件）。 */
export function reloadTokenFromDiskIfEmpty(): void {
  if (accessToken) return;
  loadFromDisk();
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (accessToken) {
    // 从 JWT exp 重新推断 expiresAt，避免同一进程多次登录后过期时间不更新
    const inferred = decodeJwtExpIso(accessToken);
    if (inferred) expiresAt = inferred;
    saveToDisk();
  } else {
    expiresAt = null;
    saveToDisk();
  }
}

export function setRefreshToken(token: string | null): void {
  refreshToken = token;
  if (accessToken) saveToDisk();
}

export function setExpiresAt(expiresAtRaw: number | string | null): void {
  if (expiresAtRaw === null) {
    expiresAt = null;
    saveToDisk();
    return;
  }

  // 后端 expires_in 通常是秒数（number）或可解析为 number。
  const seconds = typeof expiresAtRaw === 'number' ? expiresAtRaw : Number(expiresAtRaw);
  if (Number.isFinite(seconds) && seconds > 0) {
    expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
    saveToDisk();
    return;
  }

  // 兜底：如果后端直接给 ISO 字符串，就尝试解析。
  const asDate = new Date(String(expiresAtRaw));
  if (!Number.isNaN(asDate.getTime())) {
    expiresAt = asDate.toISOString();
    saveToDisk();
    return;
  }

  expiresAt = null;
  saveToDisk();
}

export function setUser(u: StoredUser | null): void {
  user = u;
  if (accessToken) saveToDisk();
}

export function setRequiresOnboarding(next: boolean): void {
  requiresOnboarding = next === true;
  if (accessToken) saveToDisk();
}

export function setTokenPair(params: {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresIn?: number | string | null;
  user?: StoredUser | null;
  requiresOnboarding?: boolean;
}): void {
  if ('accessToken' in params) accessToken = params.accessToken ?? null;
  if ('refreshToken' in params) refreshToken = params.refreshToken ?? null;
  if ('expiresIn' in params) setExpiresAt(params.expiresIn ?? null);
  if ('user' in params) setUser(params.user ?? null);
  if ('requiresOnboarding' in params) setRequiresOnboarding(params.requiresOnboarding === true);

  // 如果 expiresIn 没提供（或传了 null），就用 JWT exp 补全
  if (accessToken && (!('expiresIn' in params) || params.expiresIn == null)) {
    const inferred = decodeJwtExpIso(accessToken);
    if (inferred) expiresAt = inferred;
  }

  if (accessToken) saveToDisk();
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function getExpiresAt(): string | null {
  return expiresAt;
}

export function getUser(): StoredUser | null {
  return user;
}

export function getRequiresOnboarding(): boolean {
  return requiresOnboarding;
}

/**
 * 兼容旧逻辑：仅设置 access token（不包含 refresh token）。
 * 这样仍可用于调用需要 Authorization header 的接口；但 refresh/logout-all 可能无法完成。
 */
export function setToken(token: string): void {
  accessToken = token;
  const inferred = decodeJwtExpIso(accessToken);
  if (inferred) expiresAt = inferred;
  saveToDisk();
}

export function getToken(): string | null {
  return accessToken;
}

export function clearToken(): void {
  accessToken = null;
  refreshToken = null;
  expiresAt = null;
  user = null;
  requiresOnboarding = false;
  clearDisk();
}

export function isLoggedIn(): boolean {
  return accessToken !== null;
}

