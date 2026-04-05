import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  cli,
  withGw,
  assertCliBuilt,
  ensureGatewayRunning,
  setupTestSession,
  teardownTestSession,
  extractJson,
} from '../_helpers.js';

describe('debug tool', { timeout: 180_000 }, () => {
  let clientId = '';
  let serverId = '';

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    const s = await setupTestSession();
    clientId = s.clientId;
    serverId = s.serverId;
  });

  after(async () => {
    await teardownTestSession({ serverId, clientId });
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
});
