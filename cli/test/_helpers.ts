import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CLI_ROOT = path.resolve(__dirname, '..');
export const CLI_BIN = path.join(CLI_ROOT, 'bin', 'openmcp-cli.js');
const NODE = process.execPath;

export const TEST_GATEWAY_PORT = 19282;
export const TEST_WEBUI_PORT = 19283;

const testEnv: NodeJS.ProcessEnv = {
  ...process.env,
  OPENMCP_WEB_DEV: '',
};

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ────────────────── 基础工具 ──────────────────

export function assertCliBuilt(): void {
  const dist = path.join(CLI_ROOT, 'dist', 'index.js');
  if (!fs.existsSync(dist)) {
    throw new Error(
      `CLI 尚未构建: ${dist} 不存在。\n请先在 ${CLI_ROOT} 执行 npm run build`,
    );
  }
}

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

let gatewayE2eChain: Promise<unknown> = Promise.resolve();

export async function gatewaySerial<T>(fn: () => Promise<T>): Promise<T> {
  const next = gatewayE2eChain.then(() => fn());
  gatewayE2eChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next as Promise<T>;
}

export function gwUrl(): string {
  return `ws://localhost:${TEST_GATEWAY_PORT}`;
}

export function withGw(args: string[]): string[] {
  return [...args, '-g', gwUrl()];
}

function looksLikeGatewayUnreachable(r: ExecResult): boolean {
  return (
    r.exitCode !== 0 &&
    (r.stderr.includes('ECONNREFUSED') ||
      r.stderr.includes('无法连接到 OpenMCP Gateway'))
  );
}

/**
 * 先确保 Gateway 可达，再执行带 `-g` 的 CLI；若仍报连接被拒绝则再 ensure 并重试一次。
 * 缓解多测试文件 / 子测试并行时偶发的 ECONNREFUSED。
 */
export async function cliWithGwReady(args: string[], timeoutMs = 60_000): Promise<ExecResult> {
  await ensureGatewayRunning();
  let r = await cli(withGw(args), timeoutMs);
  if (looksLikeGatewayUnreachable(r)) {
    await ensureGatewayRunning();
    r = await cli(withGw(args), timeoutMs);
  }
  return r;
}

export function cli(args: string[], timeoutMs = 60_000): Promise<ExecResult> {
  return new Promise(resolve => {
    const child = nodeSpawn(NODE, [CLI_BIN, ...args], {
      stdio: 'pipe',
      env: testEnv,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({ stdout, stderr, exitCode: -1 });
      }
    }, timeoutMs);

    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', code => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      }
    });
  });
}

export function spawnCli(args: string[]): ChildProcess {
  return nodeSpawn(NODE, [CLI_BIN, ...args], { stdio: 'pipe', env: testEnv });
}

export function killChild(child: ChildProcess, tree = true): Promise<void> {
  return new Promise(resolve => {
    if (!child.pid || child.killed) { resolve(); return; }
    const fallback = setTimeout(resolve, 5000);
    child.on('close', () => { clearTimeout(fallback); resolve(); });
    if (process.platform === 'win32') {
      const args = ['/PID', String(child.pid), '/F'];
      if (tree) args.push('/T');
      nodeSpawn('taskkill', args, { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  });
}

// ────────────────── 可达性检测 ──────────────────

export function isGatewayReachable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const ws = new WebSocket(`ws://localhost:${port}`);
      const timer = setTimeout(() => { try { ws.terminate(); } catch {} resolve(false); }, 3000);
      ws.on('open', () => { clearTimeout(timer); try { ws.close(); } catch {} resolve(true); });
      ws.on('error', () => { clearTimeout(timer); try { ws.terminate(); } catch {} resolve(false); });
    } catch { resolve(false); }
  });
}

export function isWebuiReachable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${port}/__openmcp_web_health`, { timeout: 2000 }, res => {
      let data = '';
      res.on('data', (c: Buffer) => { data += c.toString(); });
      res.on('end', () => { try { resolve(JSON.parse(data)?.app === 'openmcp-web-ui'); } catch { resolve(false); } });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

export async function waitForGateway(port: number, timeoutMs = 20_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (await isGatewayReachable(port)) return true; await sleep(1000); }
  return false;
}

export async function waitForWebui(port: number, timeoutMs = 25_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (await isWebuiReachable(port)) return true; await sleep(1000); }
  return false;
}

export async function waitForWebuiDown(port: number, timeoutMs = 10_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (!(await isWebuiReachable(port))) return true; await sleep(500); }
  return false;
}

export async function waitForGatewayDown(port: number, timeoutMs = 10_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (!(await isGatewayReachable(port))) return true; await sleep(500); }
  return false;
}

// ────────────────── HTTP 请求 ──────────────────

export function httpGet(port: number, urlPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${urlPath}`, { timeout: 5000 }, res => {
      let data = '';
      res.on('data', (c: Buffer) => { data += c.toString(); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('httpGet timeout')); });
  });
}

// ────────────────── JSON 解析 ──────────────────

export function extractJson(stdout: string): any | null {
  const trimmed = stdout.trim();
  try { return JSON.parse(trimmed); } catch {}
  const matches = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/g);
  if (matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
      try { return JSON.parse(matches[i]); } catch {}
    }
  }
  return null;
}

// ────────────────── 临时文件 ──────────────────

const tmpFiles: string[] = [];

export function writeTmpJson(data: unknown, label = 'data'): string {
  const filePath = path.join(os.tmpdir(), `openmcp-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  tmpFiles.push(filePath);
  return filePath;
}

export function cleanupTmpFiles(): void {
  for (const f of tmpFiles) { try { fs.unlinkSync(f); } catch {} }
  tmpFiles.length = 0;
}

// ────────────────── webui 参数 ──────────────────

export function webuiArgs(sub: string): string[] {
  const base = ['webui', sub, '-p', String(TEST_WEBUI_PORT)];
  if (sub !== 'stop') base.push('-g', String(TEST_GATEWAY_PORT));
  return base;
}

// ────────────────── 生命周期管理 ──────────────────

export async function ensureGatewayRunning(): Promise<void> {
  if (await isGatewayReachable(TEST_GATEWAY_PORT)) return;
  const r = await cli(['gateway', 'start', '-p', String(TEST_GATEWAY_PORT)]);
  const ok = await waitForGateway(TEST_GATEWAY_PORT);
  if (!ok) throw new Error(`Gateway 未能在端口 ${TEST_GATEWAY_PORT} 上启动。\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
}

export async function stopGateway(): Promise<void> {
  if (!(await isGatewayReachable(TEST_GATEWAY_PORT))) return;
  await cli(['gateway', 'stop', '-p', String(TEST_GATEWAY_PORT)]);
}

export async function ensureWebuiStopped(): Promise<void> {
  // 始终调用 stop —— CLI 内部通过 PID 文件 + 端口检测来定位进程，
  // 比仅靠 HTTP 健康检查更可靠（进程活着但端口未就绪时也能清理）。
  await cli(['webui', 'stop', '-p', String(TEST_WEBUI_PORT)]);
  await sleep(1000);
  if (await isWebuiReachable(TEST_WEBUI_PORT)) {
    await cli(['webui', 'stop', '-p', String(TEST_WEBUI_PORT)]);
    const down = await waitForWebuiDown(TEST_WEBUI_PORT);
    if (!down) throw new Error(`无法停止 WebUI (port ${TEST_WEBUI_PORT})`);
  }
}

export async function startAndWaitWebui(): Promise<void> {
  const child = spawnCli(webuiArgs('start'));
  let output = '';
  child.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
  child.stderr?.on('data', (d: Buffer) => { output += d.toString(); });
  const up = await waitForWebui(TEST_WEBUI_PORT);
  // tree=false: 只杀 CLI 进程本身，保留 detached 的 renderer 进程
  await killChild(child, false);
  if (!up) throw new Error(`WebUI 未能启动。\nCLI 输出:\n${output}`);
}

// ────────────────── MCP Server / Session 辅助 ──────────────────

export const TEST_MCP_SERVER_CONFIG = {
  connectionType: 'STDIO',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-everything'],
  name: `e2e-test-server-${Date.now()}`,
  description: 'E2E 自动测试用 MCP Server',
};

export async function addTestServer(config?: Record<string, unknown>): Promise<string> {
  const cfg = config ?? { ...TEST_MCP_SERVER_CONFIG, name: `e2e-test-${Date.now()}` };
  const file = writeTmpJson(cfg, 'server');
  const r = await cli(withGw(['mcp', 'server', 'add', '--file', file]));
  if (r.exitCode !== 0) throw new Error(`添加测试 Server 失败: ${r.stdout}\n${r.stderr}`);
  const m = r.stdout.match(/\(([^)]+)\)\s*$/m);
  if (!m) throw new Error(`无法从输出解析 Server ID: ${r.stdout}`);
  return m[1];
}

export async function deleteServer(id: string): Promise<void> {
  await cli(withGw(['mcp', 'server', 'delete', '--id', id]));
}

export async function connectToServer(serverId: string): Promise<string> {
  const r = await cli(withGw(['mcp', 'session', 'connect', '--id', serverId]), 120_000);
  if (r.exitCode !== 0) throw new Error(`连接失败: ${r.stdout}\n${r.stderr}`);
  const m = r.stdout.match(/clientId:\s*(\S+)/);
  if (!m) throw new Error(`无法从输出解析 clientId: ${r.stdout}`);
  return m[1];
}

export async function disconnectSession(clientId: string): Promise<void> {
  await cli(withGw(['mcp', 'session', 'disconnect', '--client-id', clientId]));
}

/**
 * 完整流程：添加测试 MCP Server → 连接 → 返回 { serverId, clientId }。
 * 调用方需在 after() 中做清理。
 */
export async function setupTestSession(): Promise<{ serverId: string; clientId: string }> {
  const serverId = await addTestServer();
  const clientId = await connectToServer(serverId);
  return { serverId, clientId };
}

export async function teardownTestSession(ids: { serverId?: string; clientId?: string }): Promise<void> {
  if (ids.clientId) await disconnectSession(ids.clientId).catch(() => {});
  if (ids.serverId) await deleteServer(ids.serverId).catch(() => {});
  cleanupTmpFiles();
}
