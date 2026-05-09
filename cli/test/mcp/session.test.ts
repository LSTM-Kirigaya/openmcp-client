import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  cli,
  withGw,
  assertCliBuilt,
  ensureGatewayRunning,
  extractJson,
  cleanupTmpFiles,
  addTestServer,
  deleteServer,
  disconnectSession,
  ensureEverythingServerPackageCached,
  TEST_HOME,
} from '../_helpers.js';

const SESSION_SERVER_CONFIG = {
  connectionType: 'STDIO',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-everything'],
  name: 'session-test-server',
};

function writeSessionStore(value: unknown): void {
  const storePath = path.join(TEST_HOME, '.openmcp', 'runtime', 'mcp-sessions.json');
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(value, null, 2), 'utf-8');
}

describe('mcp session lifecycle', { timeout: 180_000 }, () => {
  let serverId = '';
  let clientId = '';
  let connectedClientId = '';

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    await ensureEverythingServerPackageCached();
    serverId = await addTestServer(SESSION_SERVER_CONFIG);
  });

  after(async () => {
    if (clientId) await disconnectSession(clientId).catch(() => {});
    if (serverId) await deleteServer(serverId).catch(() => {});
    cleanupTmpFiles();
  });

  it('connect: exit 0 and parse clientId', async () => {
    const r = await cli(withGw(['mcp', 'session', 'connect', '--id', serverId]), 120_000);
    assert.equal(r.exitCode, 0, `stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    const m = r.stdout.match(/clientId:\s*(\S+)/);
    assert.ok(m, `expected clientId in output:\n${r.stdout}`);
    clientId = m[1];
    connectedClientId = clientId;
  });

  it('connect: same server reuses existing clientId', async () => {
    const r = await cli(withGw(['mcp', 'session', 'connect', '--id', serverId]), 120_000);
    assert.equal(r.exitCode, 0, `stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    const m = r.stdout.match(/clientId:\s*(\S+)/);
    assert.ok(m, `expected clientId in output:\n${r.stdout}`);
    assert.equal(m[1], clientId, r.stdout);
    const body = extractJson(r.stdout);
    assert.equal(body?.msg?.reuseConnection, true, JSON.stringify(body));
  });

  it('session list: code 200 and session present', async () => {
    const r = await cli(withGw(['mcp', 'session', 'list']));
    assert.equal(r.exitCode, 0, r.stderr);
    const body = extractJson(r.stdout);
    assert.ok(body && typeof body === 'object', `no JSON:\n${r.stdout}`);
    assert.equal(body.code, 200, JSON.stringify(body));
    const sessions = body.msg;
    assert.ok(Array.isArray(sessions), `msg should be array: ${JSON.stringify(body)}`);
    assert.ok(
      sessions.some((s: { clientId?: string }) => s.clientId === clientId),
      `clientId ${clientId} not in ${JSON.stringify(sessions)}`,
    );
  });

  it('session current: currentClientId matches (no -g)', async () => {
    const r = await cli(['mcp', 'session', 'current']);
    assert.equal(r.exitCode, 0, r.stderr);
    const body = extractJson(r.stdout);
    assert.equal(body?.currentClientId, clientId, JSON.stringify(body));
  });

  it('session recent: includes connected session', async () => {
    const r = await cli(['mcp', 'session', 'recent', '--limit', '5']);
    assert.equal(r.exitCode, 0, r.stderr);
    const body = extractJson(r.stdout);
    assert.equal(body?.currentClientId, clientId, JSON.stringify(body));
    assert.ok(
      body?.recent?.some((s: { clientId?: string }) => s.clientId === clientId),
      JSON.stringify(body),
    );
  });

  it('session use: switches default session', async () => {
    writeSessionStore({ recent: [] });
    const use = await cli(withGw(['mcp', 'session', 'use', '--client-id', clientId]));
    assert.equal(use.exitCode, 0, use.stderr);
    const body = extractJson(use.stdout);
    assert.equal(body?.currentClientId, clientId, JSON.stringify(body));

    const current = await cli(['mcp', 'session', 'current']);
    assert.equal(current.exitCode, 0, current.stderr);
    const currentBody = extractJson(current.stdout);
    assert.equal(currentBody?.currentClientId, clientId, JSON.stringify(currentBody));
  });

  it('session use: rejects inactive or mistyped clientId', async () => {
    const badClientId = `${clientId}${clientId}`;
    const use = await cli(withGw(['mcp', 'session', 'use', '--client-id', badClientId]));
    assert.notEqual(use.exitCode, 0);
    const output = `${use.stdout}\n${use.stderr}`;
    assert.match(output, /Session is not active in Gateway/);
    assert.match(output, new RegExp(clientId));
  });

  it('disconnect: exit 0', async () => {
    const r = await cli(withGw(['mcp', 'session', 'disconnect', '--client-id', clientId]));
    assert.equal(r.exitCode, 0, `stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
    clientId = '';
  });

  it('session current: disconnect clears stale current session', async () => {
    const r = await cli(withGw(['mcp', 'session', 'current']));
    assert.equal(r.exitCode, 0, r.stderr);
    const body = extractJson(r.stdout);
    assert.equal(body?.currentClientId, null, JSON.stringify(body));
  });

  it('session list: clientId no longer active', async () => {
    const r = await cli(withGw(['mcp', 'session', 'list']));
    assert.equal(r.exitCode, 0);
    const body = extractJson(r.stdout);
    assert.equal(body?.code, 200);
    const sessions = body?.msg;
    assert.ok(Array.isArray(sessions));
    assert.ok(
      !sessions.some((s: { clientId?: string }) => s.clientId === connectedClientId),
      `expected ${connectedClientId} removed from ${JSON.stringify(sessions)}`,
    );
  });

  it('commands reject a stale stored default after Gateway sessions are gone', async () => {
    writeSessionStore({
      currentClientId: connectedClientId,
      recent: [
        {
          clientId: connectedClientId,
          gateway: 'ws://localhost:19282',
          connectedAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        },
      ],
    });

    const r = await cli(withGw(['debug', 'tool', 'list']), 120_000);
    assert.notEqual(r.exitCode, 0);
    const output = `${r.stderr}\n${r.stdout}`;
    assert.match(output, /Stored default session is not active in Gateway/);
    assert.match(output, /Gateway has no active MCP sessions|Active sessions:/);
    assert.doesNotMatch(output, /MCP client .* not found/);
  });
});
