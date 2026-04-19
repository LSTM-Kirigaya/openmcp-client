import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let loaded = false;

function resolveMode(): string {
  const appEnv = String(process.env.OPENMCP_APP_ENV || '').trim().toLowerCase();
  if (appEnv) {
    return appEnv;
  }
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv) {
    return nodeEnv;
  }
  return 'development';
}

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) {
      process.env[k] = v;
    }
  }
}

/** 读取 service 包根目录下的环境文件，不覆盖已在环境中的变量 */
export function loadServiceDotEnv(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

  const mode = resolveMode();
  for (const file of [
    `.env.${mode}.local`,
    `.env.${mode}`,
    '.env.local',
    '.env'
  ]) {
    loadEnvFile(join(root, file));
  }
}
