import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let loaded = false;

/** 读取 service 包根目录下的 .env（不覆盖已在环境中的变量） */
export function loadServiceDotEnv(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const p = join(root, '.env');
  if (!existsSync(p)) {
    return;
  }
  const text = readFileSync(p, 'utf8');
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
