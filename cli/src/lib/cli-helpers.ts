import fs from 'fs';
import { createMessageBridge, type MessageBridge } from './message-bridge.js';

export const DEFAULT_GATEWAY = 'ws://localhost:8282';

export function parseJsonData(raw?: string): Record<string, unknown> {
  if (!raw || raw.trim() === '') {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid JSON for --data');
  }
}

export function readJsonFile(path: string): Record<string, unknown> {
  const text = fs.readFileSync(path, 'utf-8');
  return JSON.parse(text) as Record<string, unknown>;
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export async function withGateway<T>(
  gatewayUrl: string,
  fn: (bridge: MessageBridge) => Promise<T>
): Promise<T> {
  const bridge = await createMessageBridge(gatewayUrl);
  try {
    return await fn(bridge);
  } finally {
    await bridge.close();
  }
}
