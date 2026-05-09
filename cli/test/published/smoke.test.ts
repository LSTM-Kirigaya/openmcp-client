import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn as nodeSpawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractJson,
  isGatewayReachable,
  testEnvironment,
  waitForGateway,
  waitForGatewayDown,
  writeTmpJson,
  cleanupTmpFiles,
} from '../_helpers.js';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const PUBLISHED_PORT = 19382;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPackageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf-8'),
) as { name: string; version: string };
const PUBLISHED_PACKAGE = `${cliPackageJson.name}@${cliPackageJson.version}`;

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function execFile(command: string, args: string[], cwd: string, timeoutMs = 180_000): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = nodeSpawn(command, args, {
      cwd,
      stdio: 'pipe',
      shell: process.platform === 'win32',
      windowsHide: true,
      env: {
        ...testEnvironment(),
        HOME: path.join(cwd, 'home'),
        USERPROFILE: path.join(cwd, 'home'),
        APPDATA: path.join(cwd, 'appdata'),
      },
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
    child.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      }
    });
  });
}

function npm(args: string[], cwd: string, timeoutMs?: number) {
  return execFile(NPM, args, cwd, timeoutMs);
}

function openmcp(args: string[], cwd: string, timeoutMs?: number) {
  return execFile(NPX, ['openmcp', ...args], cwd, timeoutMs);
}

describe(`published ${PUBLISHED_PACKAGE} smoke`, { timeout: 600_000 }, () => {
  let projectDir = '';
  let serverId = '';
  let clientId = '';
  let installed = false;

  before(async () => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmcp-published-e2e-'));
    fs.mkdirSync(path.join(projectDir, 'home'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'appdata'), { recursive: true });

    const init = await npm(['init', '-y'], projectDir, 60_000);
    assert.equal(init.exitCode, 0, `npm init failed:\n${init.stdout}\n${init.stderr}`);

    const install = await npm(
      ['install', PUBLISHED_PACKAGE, '--no-audit', '--no-fund'],
      projectDir,
      600_000,
    );
    assert.equal(install.exitCode, 0, `npm install failed:\n${install.stdout}\n${install.stderr}`);
    installed = true;

    const warmEverything = await npm(
      [
        'exec',
        '--yes',
        '--package',
        '@modelcontextprotocol/server-everything',
        '--',
        'node',
        '--version',
      ],
      projectDir,
      180_000,
    );
    assert.equal(
      warmEverything.exitCode,
      0,
      `warming everything server package failed:\n${warmEverything.stdout}\n${warmEverything.stderr}`,
    );

    const distTag = await npm(['view', '@agent-ruler/openmcp', 'dist-tags', '--json'], projectDir, 60_000);
    if (distTag.exitCode === 0) {
      console.log(`@agent-ruler/openmcp dist-tags: ${distTag.stdout.trim()}`);
    }
  });

  after(async () => {
    if (installed && clientId) await openmcp(['mcp', 'session', 'disconnect', '--client-id', clientId, '-g', `ws://localhost:${PUBLISHED_PORT}`], projectDir).catch(() => {});
    if (installed && serverId) await openmcp(['mcp', 'server', 'delete', '--id', serverId, '-g', `ws://localhost:${PUBLISHED_PORT}`], projectDir).catch(() => {});
    if (installed && projectDir) await openmcp(['gateway', 'stop', '-p', String(PUBLISHED_PORT)], projectDir).catch(() => {});
    await waitForGatewayDown(PUBLISHED_PORT, 15_000).catch(() => {});
    cleanupTmpFiles();
    if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('npx openmcp help and version work', async () => {
    const help = await openmcp(['--help'], projectDir, 60_000);
    assert.equal(help.exitCode, 0, `help failed:\n${help.stdout}\n${help.stderr}`);
    assert.match(help.stdout, /Usage: openmcp/);

    const version = await openmcp(['--version'], projectDir, 60_000);
    assert.equal(version.exitCode, 0, `version failed:\n${version.stdout}\n${version.stderr}`);
    assert.equal(version.stdout.trim(), cliPackageJson.version);
  });

  it('published gateway starts, reports status, then serves MCP ping', async () => {
    const start = await openmcp(['gateway', 'start', '-p', String(PUBLISHED_PORT)], projectDir, 120_000);
    assert.equal(start.exitCode, 0, `gateway start failed:\n${start.stdout}\n${start.stderr}`);
    assert.ok(await waitForGateway(PUBLISHED_PORT, 30_000), 'published gateway should be reachable');

    const status = await openmcp(['gateway', 'status', '-p', String(PUBLISHED_PORT)], projectDir, 60_000);
    assert.equal(status.exitCode, 0, `gateway status failed:\n${status.stdout}\n${status.stderr}`);
    assert.match(status.stdout, /Running/);

    const serverFile = writeTmpJson({
      connectionType: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      name: 'published-everything',
    }, 'published-server');
    const add = await openmcp(
      ['mcp', 'server', 'add', '--file', serverFile, '-g', `ws://localhost:${PUBLISHED_PORT}`],
      projectDir,
      120_000,
    );
    assert.equal(add.exitCode, 0, `server add failed:\n${add.stdout}\n${add.stderr}`);
    const idMatch = add.stdout.match(/\(([^)]+)\)\s*$/m);
    assert.ok(idMatch, `could not parse server id:\n${add.stdout}`);
    serverId = idMatch[1];

    const connect = await openmcp(
      ['mcp', 'session', 'connect', '--id', serverId, '-g', `ws://localhost:${PUBLISHED_PORT}`],
      projectDir,
      180_000,
    );
    assert.equal(connect.exitCode, 0, `connect failed:\n${connect.stdout}\n${connect.stderr}`);
    const clientMatch = connect.stdout.match(/clientId:\s*(\S+)/);
    assert.ok(clientMatch, `could not parse client id:\n${connect.stdout}`);
    clientId = clientMatch[1];

    const ping = await openmcp(
      ['debug', 'mcp', 'ping', '--client-id', clientId, '-g', `ws://localhost:${PUBLISHED_PORT}`],
      projectDir,
      120_000,
    );
    assert.equal(ping.exitCode, 0, `ping failed:\n${ping.stdout}\n${ping.stderr}`);
    const j = extractJson(ping.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
  });

  it('published gateway stop closes the port', async () => {
    assert.ok(await isGatewayReachable(PUBLISHED_PORT));
    const stop = await openmcp(['gateway', 'stop', '-p', String(PUBLISHED_PORT)], projectDir, 120_000);
    assert.equal(stop.exitCode, 0, `gateway stop failed:\n${stop.stdout}\n${stop.stderr}`);
    assert.ok(await waitForGatewayDown(PUBLISHED_PORT, 20_000), 'published gateway should stop');
  });
});
