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
  writeTmpJson,
  cleanupTmpFiles,
} from '../_helpers.js';

describe('debug mcp', { timeout: 180_000 }, () => {
  let clientId = '';
  let serverId = '';
  let initOut = '';
  let exportOut = '';

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    const s = await setupTestSession();
    clientId = s.clientId;
    serverId = s.serverId;
    initOut = path.join(os.tmpdir(), `openmcp-test-init-${Date.now()}.json`);
    exportOut = path.join(os.tmpdir(), `openmcp-test-export-${Date.now()}.json`);
  });

  after(async () => {
    await teardownTestSession({ serverId, clientId });
    cleanupTmpFiles();
    try { fs.unlinkSync(initOut); } catch {}
    try { fs.unlinkSync(exportOut); } catch {}
  });

  it('pings session', async () => {
    const r = await cli(withGw(['debug', 'mcp', 'ping', '--client-id', clientId]), 120_000);
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
  });

  it('reads server-version', async () => {
    const r = await cli(withGw(['debug', 'mcp', 'server-version', '--client-id', clientId]), 120_000);
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
  });

  it('lookup-env resolves PATH', async () => {
    const r = await cli(withGw(['debug', 'mcp', 'lookup-env', '--keys', 'PATH']), 120_000);
    assert.equal(r.exitCode, 0, `stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
    assert.ok(Array.isArray(j.msg), JSON.stringify(j));
    assert.ok(typeof j.msg[0] === 'string' && j.msg[0].length > 0, JSON.stringify(j));
  });

  it('config init writes stdio template', async () => {
    const r = await cli(['debug', 'mcp', 'config', 'init', '--template', 'stdio', '-o', initOut]);
    assert.equal(r.exitCode, 0);
    assert.ok(fs.existsSync(initOut));
    const parsed = JSON.parse(fs.readFileSync(initOut, 'utf-8'));
    assert.ok(parsed.connectionType);
  });

  it('config validate accepts stdio file', async () => {
    const f = writeTmpJson({ connectionType: 'STDIO', command: 'npx', args: ['-y', 'pkg'] }, 'mcp-valid');
    const r = await cli(['debug', 'mcp', 'config', 'validate', '-f', f]);
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.equal(j.ok, true);
  });

  it('config validate rejects empty object', async () => {
    const f = writeTmpJson({}, 'mcp-invalid');
    const r = await cli(['debug', 'mcp', 'config', 'validate', '-f', f]);
    assert.notEqual(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.equal(j.ok, false);
  });

  it('config env-preview shows injected env keys', async () => {
    const f = writeTmpJson({
      connectionType: 'STDIO',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      env: { OPENMCP_E2E_ENV: 'yes' },
    }, 'mcp-env');
    const r = await cli(['debug', 'mcp', 'config', 'env-preview', '-f', f]);
    assert.equal(r.exitCode, 0, r.stderr);
    const j = extractJson(r.stdout);
    assert.equal(j.connectionType, 'STDIO');
    assert.ok(j.injectedKeys.includes('OPENMCP_E2E_ENV'), JSON.stringify(j));
    assert.deepEqual(j.mergedEnv, { OPENMCP_E2E_ENV: 'yes' }, JSON.stringify(j));
    assert.ok(j.omittedKeys > 0, JSON.stringify(j));
  });

  it('config export writes mcpServers config for current session', async () => {
    const r = await cli([
      'debug',
      'mcp',
      'config',
      'export',
      '--client-id',
      clientId,
      '--name',
      'everything-e2e',
      '-o',
      exportOut,
    ]);
    assert.equal(r.exitCode, 0, `stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    assert.ok(fs.existsSync(exportOut));
    const parsed = JSON.parse(fs.readFileSync(exportOut, 'utf-8'));
    assert.ok(parsed.mcpServers?.['everything-e2e'], JSON.stringify(parsed));
  });

  it('history list prints rows', async () => {
    const r = await cli(['debug', 'mcp', 'history', 'list']);
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.ok(Array.isArray(j.rows));
  });

  it('history replay can replay a previous ping request', async () => {
    const list = await cli(['debug', 'mcp', 'history', 'list', '--command', 'ping', '--limit', '1']);
    assert.equal(list.exitCode, 0, list.stderr);
    const history = extractJson(list.stdout);
    const id = history?.rows?.[0]?.id;
    assert.ok(id, JSON.stringify(history));

    const replay = await cli(withGw(['debug', 'mcp', 'history', 'replay', '--id', id]), 120_000);
    assert.equal(replay.exitCode, 0, `stderr:\n${replay.stderr}\nstdout:\n${replay.stdout}`);
    const j = extractJson(replay.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
  });
});
