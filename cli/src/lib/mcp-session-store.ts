import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface SessionRecord {
  clientId: string;
  gateway: string;
  connectedAt: string;
  lastUsedAt: string;
  connectPayload?: Record<string, unknown>;
}

interface SessionState {
  currentClientId?: string;
  recent: SessionRecord[];
}

const SESSION_DIR = path.join(os.homedir(), '.openmcp', 'runtime');
const SESSION_FILE = path.join(SESSION_DIR, 'mcp-sessions.json');
const LEGACY_SESSION_FILE = path.join(os.homedir(), '.openmcp', 'mcp-sessions.json');
const MAX_RECENT = 30;

function defaultState(): SessionState {
  return { recent: [] };
}

function readState(): SessionState {
  try {
    if (!fs.existsSync(SESSION_FILE) && fs.existsSync(LEGACY_SESSION_FILE)) {
      if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
      }
      fs.copyFileSync(LEGACY_SESSION_FILE, SESSION_FILE);
    }
    if (!fs.existsSync(SESSION_FILE)) return defaultState();
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed || !Array.isArray(parsed.recent)) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function writeState(state: SessionState): void {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
  fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function getCurrentClientId(): string | undefined {
  const state = readState();
  if (!state.currentClientId) return undefined;
  const exists = state.recent.some((s) => s.clientId === state.currentClientId);
  return exists ? state.currentClientId : undefined;
}

export function getRecentSessions(limit?: number): SessionRecord[] {
  const state = readState();
  const records = [...state.recent].sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
  if (!limit || limit <= 0) return records;
  return records.slice(0, limit);
}

export function setCurrentClientId(clientId: string): void {
  const state = readState();
  state.currentClientId = clientId;
  writeState(state);
}

export function rememberSession(
  clientId: string,
  gateway: string,
  connectPayload?: Record<string, unknown>
): SessionRecord {
  const state = readState();
  const now = new Date().toISOString();
  const existing = state.recent.find((s) => s.clientId === clientId);
  if (existing) {
    existing.gateway = gateway;
    existing.lastUsedAt = now;
    if (connectPayload) existing.connectPayload = connectPayload;
  } else {
    state.recent.unshift({
      clientId,
      gateway,
      connectedAt: now,
      lastUsedAt: now,
      connectPayload
    });
  }

  state.recent = state.recent
    .sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1))
    .slice(0, MAX_RECENT);
  state.currentClientId = clientId;
  writeState(state);
  return state.recent[0];
}

export function removeSession(clientId: string): void {
  const state = readState();
  state.recent = state.recent.filter((s) => s.clientId !== clientId);
  if (state.currentClientId === clientId) {
    state.currentClientId = state.recent[0]?.clientId;
  }
  writeState(state);
}

export function requireClientId(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim();
  const current = getCurrentClientId();
  if (current) return current;
  throw new Error('缺少 --client-id，且当前没有默认会话。请先执行 mcp session connect 或 mcp session use。');
}

export function getSessionByClientId(clientId: string): SessionRecord | undefined {
  const state = readState();
  return state.recent.find((s) => s.clientId === clientId);
}

export function getSessionStorePath(): string {
  return SESSION_FILE;
}
