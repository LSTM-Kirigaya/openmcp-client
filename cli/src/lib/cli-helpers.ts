import fs from 'fs';
import { createMessageBridge, type MessageBridge } from './message-bridge.js';
import { diagnoseResponse } from './error-diagnose.js';

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

export function writeJsonFile(path: string, value: unknown): void {
  fs.writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printResponse(
  command: string,
  response: { code: number; msg?: unknown; data?: unknown; _id?: string }
): void {
  printJson(response);
  if (response.code !== 200) {
    const tips = diagnoseResponse(command, response as any);
    for (const tip of tips) {
      console.error(`[diagnose] ${tip}`);
    }
  }
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
