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

describe('debug prompt', { timeout: 180_000 }, () => {
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

  it('lists prompts', async () => {
    const r = await cli(withGw(['debug', 'prompt', 'list', '--client-id', clientId]), 120_000);
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
    const n = j.msg?.prompts?.length ?? 0;
    assert.ok(n > 0, 'expected prompts');
  });

  it('gets simple-prompt', async () => {
    const r = await cli(
      withGw(['debug', 'prompt', 'get', '--client-id', clientId, '--prompt-id', 'simple-prompt']),
      120_000,
    );
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
  });
});
