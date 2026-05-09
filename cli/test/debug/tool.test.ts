import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  cli,
  withGw,
  assertCliBuilt,
  ensureGatewayRunning,
  setupTestSession,
  teardownTestSession,
  extractJson,
  TEST_HOME,
} from '../_helpers.js';

function writeSessionStore(value: unknown): void {
  const storePath = path.join(TEST_HOME, '.openmcp', 'runtime', 'mcp-sessions.json');
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(value, null, 2), 'utf-8');
}

describe('debug tool', { timeout: 180_000 }, () => {
  let clientId = '';
  let serverId = '';
  let workspaceDir = '';

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    const s = await setupTestSession();
    clientId = s.clientId;
    serverId = s.serverId;
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmcp-tool-cases-e2e-'));
  });

  after(async () => {
    await teardownTestSession({ serverId, clientId });
    if (workspaceDir) fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('lists tools', async () => {
    const r = await cli(withGw(['debug', 'tool', 'list', '--client-id', clientId]), 120_000);
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
    const n = j.msg?.tools?.length ?? 0;
    assert.ok(n > 0, 'expected tools');
  });

  it('calls echo', async () => {
    const r = await cli(
      withGw([
        'debug', 'tool', 'call', '--client-id', clientId, '--name', 'echo',
        '-a', '{"message":"hello"}',
      ]),
      120_000,
    );
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
    assert.match(JSON.stringify(j.msg), /hello/);
  });

  it('auto-recovers default session from the only active Gateway session', async () => {
    writeSessionStore({ recent: [] });
    const r = await cli(
      withGw([
        'debug', 'tool', 'call', '--name', 'echo',
        '-a', '{"message":"auto default"}',
      ]),
      120_000,
    );
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    const j = extractJson(r.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
    assert.match(JSON.stringify(j.msg), /auto default/);
  });

  it('calls get-sum', async () => {
    const r = await cli(
      withGw([
        'debug', 'tool', 'call', '--client-id', clientId, '--name', 'get-sum',
        '-a', '{"a":2,"b":3}',
      ]),
      120_000,
    );
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
    assert.match(JSON.stringify(j.msg), /5/);
  });

  it('fails cleanly for invalid JSON args', async () => {
    const r = await cli(
      withGw(['debug', 'tool', 'call', '--client-id', clientId, '--name', 'echo', '-a', '{bad-json']),
      120_000,
    );
    assert.notEqual(r.exitCode, 0);
    const output = `${r.stderr}\n${r.stdout}`;
    assert.match(output, /Invalid JSON for --args/);
    assert.doesNotMatch(output, /Invalid JSON for --data/);
  });

  it('fails cleanly for missing tool', async () => {
    const r = await cli(
      withGw(['debug', 'tool', 'call', '--client-id', clientId, '--name', 'missing-e2e-tool']),
      120_000,
    );
    assert.notEqual(r.exitCode, 0, `expected failure:\n${r.stdout}`);
    const j = extractJson(r.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
    assert.equal(j?.msg?.isError, true, JSON.stringify(j));
  });

  it('test-case user scope: save/list/get/delete', async () => {
    let caseId = '';
    const data = JSON.stringify({
      id: `tool-case-user-${Date.now()}`,
      name: 'echo user case',
      toolName: 'echo',
      input: { message: 'from user case' },
      expectedOutput: 'from user case',
    });
    const save = await cli(
      withGw(['debug', 'tool', 'test-case', 'save', '--client-id', clientId, '--data', data]),
      120_000,
    );
    assert.equal(save.exitCode, 0, `stdout:\n${save.stdout}\nstderr:\n${save.stderr}`);
    const sj = extractJson(save.stdout);
    caseId = sj?.data?.id;
    assert.ok(caseId, JSON.stringify(sj));

    const list = await cli(withGw(['debug', 'tool', 'test-case', 'list', '--client-id', clientId]), 120_000);
    assert.equal(list.exitCode, 0, list.stderr);
    assert.match(list.stdout, new RegExp(caseId));

    const get = await cli(
      withGw(['debug', 'tool', 'test-case', 'get', '--client-id', clientId, '--case-id', caseId]),
      120_000,
    );
    assert.equal(get.exitCode, 0, get.stderr);
    const gj = extractJson(get.stdout);
    assert.equal(gj?.data?.toolName, 'echo', JSON.stringify(gj));

    const del = await cli(
      withGw(['debug', 'tool', 'test-case', 'delete', '--client-id', clientId, '--case-id', caseId]),
      120_000,
    );
    assert.equal(del.exitCode, 0, del.stderr);
  });

  it('test-case workspace scope: save/list/get/delete', async () => {
    let caseId = '';
    const data = JSON.stringify({
      id: `tool-case-workspace-${Date.now()}`,
      name: 'sum workspace case',
      toolName: 'get-sum',
      input: { a: 4, b: 6 },
      expectedOutput: 10,
    });
    const scoped = ['--scope', 'workspace', '--workspace', workspaceDir, '--client-id', clientId];
    const save = await cli(
      withGw(['debug', 'tool', 'test-case', 'save', ...scoped, '--data', data]),
      120_000,
    );
    assert.equal(save.exitCode, 0, `stdout:\n${save.stdout}\nstderr:\n${save.stderr}`);
    const sj = extractJson(save.stdout);
    caseId = sj?.data?.id;
    assert.ok(caseId, JSON.stringify(sj));

    const list = await cli(withGw(['debug', 'tool', 'test-case', 'list', ...scoped]), 120_000);
    assert.equal(list.exitCode, 0, list.stderr);
    assert.match(list.stdout, new RegExp(caseId));

    const get = await cli(
      withGw(['debug', 'tool', 'test-case', 'get', ...scoped, '--case-id', caseId]),
      120_000,
    );
    assert.equal(get.exitCode, 0, get.stderr);
    const gj = extractJson(get.stdout);
    assert.equal(gj?.data?.toolName, 'get-sum', JSON.stringify(gj));

    const del = await cli(
      withGw(['debug', 'tool', 'test-case', 'delete', ...scoped, '--case-id', caseId]),
      120_000,
    );
    assert.equal(del.exitCode, 0, del.stderr);
  });
});
