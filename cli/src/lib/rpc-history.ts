import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

export interface RpcHistoryRecord {
  id: string;
  ts: string;
  gateway: string;
  command: string;
  request: Record<string, unknown>;
  durationMs: number;
  ok: boolean;
  response?: {
    code: number;
    msg: unknown;
    data?: unknown;
  };
  error?: string;
}

const HISTORY_DIR = path.join(os.homedir(), '.openmcp');
const HISTORY_FILE = path.join(HISTORY_DIR, 'rpc-history.jsonl');

function ensureDir(): void {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

export function appendRpcHistory(input: Omit<RpcHistoryRecord, 'id' | 'ts'>): RpcHistoryRecord {
  ensureDir();
  const record: RpcHistoryRecord = {
    id: uuidv4(),
    ts: new Date().toISOString(),
    ...input
  };
  fs.appendFileSync(HISTORY_FILE, `${JSON.stringify(record)}\n`, 'utf-8');
  return record;
}

export function readRpcHistory(): RpcHistoryRecord[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const text = fs.readFileSync(HISTORY_FILE, 'utf-8').trim();
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RpcHistoryRecord);
  } catch {
    return [];
  }
}

export function findRpcHistoryById(id: string): RpcHistoryRecord | undefined {
  return readRpcHistory().find((r) => r.id === id);
}

export function queryRpcHistory(options: {
  limit?: number;
  command?: string;
  failedOnly?: boolean;
}): RpcHistoryRecord[] {
  const limit = options.limit ?? 20;
  const list = readRpcHistory()
    .filter((r) => (options.command ? r.command === options.command : true))
    .filter((r) => (options.failedOnly ? !r.ok : true))
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));
  if (limit <= 0) return list;
  return list.slice(0, limit);
}

export function getRpcHistoryPath(): string {
  return HISTORY_FILE;
}
