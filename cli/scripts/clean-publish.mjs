import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(cliRoot, '..');

const targets = [
  path.join(cliRoot, 'dist'),
  path.join(cliRoot, 'vendor'),
  path.join(repoRoot, 'service', 'dist'),
  path.join(repoRoot, 'gateway', 'dist'),
  path.join(repoRoot, 'renderer', 'dist')
];

for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true });
}

