import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(cliRoot, '..');
const vendorRoot = path.join(cliRoot, 'vendor');

function assertDir(dir, label) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`${label} not found: ${dir}`);
  }
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function patchGatewayImports(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  const patched = raw.replaceAll('@openmcp/service', '../../service/dist/index.js');
  fs.writeFileSync(filePath, patched);
}

const gatewayDist = path.join(repoRoot, 'gateway', 'dist');
const serviceDist = path.join(repoRoot, 'service', 'dist');
const rendererDist = path.join(repoRoot, 'renderer', 'dist');

assertDir(gatewayDist, 'gateway dist');
assertDir(serviceDist, 'service dist');
assertDir(rendererDist, 'renderer dist');

fs.rmSync(vendorRoot, { recursive: true, force: true });
copyDir(gatewayDist, path.join(vendorRoot, 'gateway', 'dist'));
copyDir(serviceDist, path.join(vendorRoot, 'service', 'dist'));
copyDir(rendererDist, path.join(vendorRoot, 'renderer', 'dist'));

for (const fileName of ['main.js', 'index.js', 'paths.js', 'index.d.ts']) {
  patchGatewayImports(path.join(vendorRoot, 'gateway', 'dist', fileName));
}

console.log(`Prepared publish vendor payload at ${vendorRoot}`);
