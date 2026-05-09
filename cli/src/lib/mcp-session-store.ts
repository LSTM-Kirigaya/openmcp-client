import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { MessageBridge } from './message-bridge.js';

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

function upsertSessionInState(
  state: SessionState,
  clientId: string,
  gateway: string,
  connectPayload?: Record<string, unknown>
): SessionRecord {
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
  return state.recent.find((s) => s.clientId === clientId) ?? state.recent[0];
}

export function rememberSession(
  clientId: string,
  gateway: string,
  connectPayload?: Record<string, unknown>
): SessionRecord {
  const state = readState();
  const record = upsertSessionInState(state, clientId, gateway, connectPayload);
  writeState(state);
  return record;
}

export function removeSession(clientId: string): void {
  const state = readState();
  state.recent = state.recent.filter((s) => s.clientId !== clientId);
  if (state.currentClientId === clientId) {
    delete state.currentClientId;
  }
  writeState(state);
}

export function reconcileGatewaySessions(gateway: string, activeClientIds: string[]): void {
  const active = new Set(activeClientIds);
  const state = readState();
  const before = state.recent.length;
  state.recent = state.recent.filter((session) => session.gateway !== gateway || active.has(session.clientId));
  let changed = state.recent.length !== before;
  if (state.currentClientId && !state.recent.some((session) => session.clientId === state.currentClientId)) {
    delete state.currentClientId;
    changed = true;
  }
  if (!state.currentClientId && activeClientIds.length === 1) {
    upsertSessionInState(state, activeClientIds[0], gateway);
    changed = true;
  }
  if (changed) {
    writeState(state);
  }
}

export function requireClientId(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim();
  const current = getCurrentClientId();
  if (current) return current;
  throw new Error('Missing --client-id and there is no current default session. Run `openmcp mcp session connect --id <SERVER_ID>` first, or pass `--client-id` explicitly.');
}

function activeClientIdsFromResponse(msg: unknown): string[] {
  return Array.isArray(msg)
    ? msg
      .map((session: any) => session?.clientId)
      .filter((clientId: unknown): clientId is string => typeof clientId === 'string')
    : [];
}

export async function resolveClientIdWithGateway(
  options: { clientId?: string; gateway: string },
  bridge: Pick<MessageBridge, 'commandRequest'>
): Promise<string> {
  const explicit = options.clientId?.trim();
  const current = getCurrentClientId();
  const res = await bridge.commandRequest('connect/list', {});
  if (res.code === 200) {
    const activeClientIds = activeClientIdsFromResponse(res.msg);
    reconcileGatewaySessions(options.gateway, activeClientIds);

    if (explicit) {
      if (activeClientIds.includes(explicit)) {
        rememberSession(explicit, options.gateway);
        return explicit;
      }
      removeSession(explicit);
      throw new Error([
        `MCP session is not active in Gateway: ${explicit}`,
        activeClientIds.length > 0
          ? `Active sessions: ${activeClientIds.join(', ')}`
          : 'Gateway has no active MCP sessions.',
        'Run `openmcp mcp session connect --id <SERVER_ID>` first, or pass an active `--client-id` from `openmcp mcp session list`.'
      ].join('\n'));
    }

    if (current && activeClientIds.includes(current)) {
      rememberSession(current, options.gateway);
      return current;
    }

    const recovered = getCurrentClientId();
    if (recovered) {
      return recovered;
    }
    if (current && !activeClientIds.includes(current)) {
      throw new Error([
        `Stored default session is not active in Gateway: ${current}`,
        activeClientIds.length > 0
          ? `Active sessions: ${activeClientIds.join(', ')}`
          : 'Gateway has no active MCP sessions.',
        'Run `openmcp mcp session connect --id <SERVER_ID>` first, or use `openmcp mcp session use --client-id <CLIENT_ID>`.'
      ].join('\n'));
    }
    if (activeClientIds.length > 1) {
      throw new Error([
        'Missing --client-id and there is no current default session.',
        `Gateway has multiple active sessions: ${activeClientIds.join(', ')}`,
        'Run `openmcp mcp session use --client-id <CLIENT_ID>` first, or pass `--client-id` explicitly.'
      ].join('\n'));
    }
  }

  if (explicit) {
    rememberSession(explicit, options.gateway);
    return explicit;
  }

  if (current) {
    rememberSession(current, options.gateway);
    return current;
  }

  throw new Error('Missing --client-id and there is no current default session. Run `openmcp mcp session connect --id <SERVER_ID>` first, or pass `--client-id` explicitly.');
}

export function getSessionByClientId(clientId: string): SessionRecord | undefined {
  const state = readState();
  return state.recent.find((s) => s.clientId === clientId);
}

export function getSessionStorePath(): string {
  return SESSION_FILE;
}
