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

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    const s = await setupTestSession();
    clientId = s.clientId;
    serverId = s.serverId;
    initOut = path.join(os.tmpdir(), `openmcp-test-init-${Date.now()}.json`);
  });

  after(async () => {
    await teardownTestSession({ serverId, clientId });
    cleanupTmpFiles();
    try { fs.unlinkSync(initOut); } catch {}
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

  it('history list prints rows', async () => {
    const r = await cli(['debug', 'mcp', 'history', 'list']);
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.ok(Array.isArray(j.rows));
  });
});
