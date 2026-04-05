import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import {
  cli,
  withGw,
  assertCliBuilt,
  ensureGatewayRunning,
  extractJson,
  cleanupTmpFiles,
  deleteServer,
} from '../_helpers.js';

/** `mcp server get` 前后可能被 Gateway 连接日志包裹，仅对「完整配置」后的 JSON 做解析 */
function extractServerGetJson(stdout: string): Record<string, unknown> | null {
  const parts = stdout.split('完整配置:\n');
  const tail = parts.length >= 2 ? (parts[parts.length - 1] ?? '') : stdout;
  const parsed = extractJson(tail);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

describe('mcp server local CRUD', { timeout: 180_000 }, () => {
  let serverId = '';
  let deletedServerId = '';

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
  });

  after(async () => {
    if (serverId) await deleteServer(serverId).catch(() => {});
    cleanupTmpFiles();
  });

  it('add: creates STDIO server via --data and parses ID', async () => {
    const cwd = process.platform === 'win32' ? os.tmpdir() : '/tmp';
    const data = JSON.stringify({
      connectionType: 'STDIO',
      command: 'node',
      args: ['--version'],
      name: 'test-crud-server',
      description: 'CRUD test',
      cwd,
    });
    const r = await cli(withGw(['mcp', 'server', 'add', '--data', data]));
    assert.equal(r.exitCode, 0, `add stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    const m = r.stdout.match(/\(([^)]+)\)\s*$/m);
    assert.ok(m, `expected ID in parentheses at line end, got:\n${r.stdout}`);
    serverId = m[1];
    assert.ok(serverId.length > 0);
  });

  it('list: --json --scope local includes new server by ID', async () => {
    const r = await cli(withGw(['mcp', 'server', 'list', '--json', '--scope', 'local']));
    assert.equal(r.exitCode, 0, r.stderr);
    const list = extractJson(r.stdout);
    assert.ok(Array.isArray(list), `expected JSON array, got:\n${r.stdout}`);
    const found = list.find((s: { id?: string }) => s.id === serverId);
    assert.ok(found, `server ${serverId} not in list`);
  });

  it('get: JSON after 完整配置 matches name, connectionType, command, args, description', async () => {
    const r = await cli(withGw(['mcp', 'server', 'get', '--id', serverId]));
    assert.equal(r.exitCode, 0, r.stderr);
    const cfg = extractServerGetJson(r.stdout);
    assert.ok(cfg, `no JSON in get output:\n${r.stdout}`);
    assert.equal(cfg.name, 'test-crud-server');
    assert.equal(cfg.connectionType, 'STDIO');
    assert.equal(cfg.command, 'node');
    assert.deepEqual(cfg.args, ['--version']);
    assert.equal(cfg.description, 'CRUD test');
  });

  it('edit: name', async () => {
    const r = await cli(
      withGw(['mcp', 'server', 'edit', '--id', serverId, '--data', '{"name":"renamed-server"}']),
    );
    assert.equal(r.exitCode, 0, r.stderr);
    const gr = await cli(withGw(['mcp', 'server', 'get', '--id', serverId]));
    assert.equal(gr.exitCode, 0);
    const cfg = extractServerGetJson(gr.stdout);
    assert.equal(cfg?.name, 'renamed-server');
  });

  it('edit: description', async () => {
    const r = await cli(
      withGw([
        'mcp',
        'server',
        'edit',
        '--id',
        serverId,
        '--data',
        '{"description":"updated desc"}',
      ]),
    );
    assert.equal(r.exitCode, 0, r.stderr);
    const gr = await cli(withGw(['mcp', 'server', 'get', '--id', serverId]));
    const cfg = extractServerGetJson(gr.stdout);
    assert.equal(cfg?.description, 'updated desc');
  });

  it('edit: command and args', async () => {
    const r = await cli(
      withGw([
        'mcp',
        'server',
        'edit',
        '--id',
        serverId,
        '--data',
        '{"command":"echo","args":["hello"]}',
      ]),
    );
    assert.equal(r.exitCode, 0, r.stderr);
    const gr = await cli(withGw(['mcp', 'server', 'get', '--id', serverId]));
    const cfg = extractServerGetJson(gr.stdout);
    assert.equal(cfg?.command, 'echo');
    assert.deepEqual(cfg?.args, ['hello']);
  });

  it('delete: succeeds', async () => {
    deletedServerId = serverId;
    const r = await cli(withGw(['mcp', 'server', 'delete', '--id', serverId]));
    assert.equal(r.exitCode, 0, r.stderr);
    serverId = '';
  });

  it('get after delete: fails', async () => {
    const r = await cli(withGw(['mcp', 'server', 'get', '--id', deletedServerId]));
    const combined = `${r.stdout}\n${r.stderr}`;
    assert.ok(
      r.exitCode !== 0 || /未找到|失败|error|not found/i.test(combined),
      `expected failure for deleted id, exit=${r.exitCode} out=${combined}`,
    );
  });
});
