import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  cli,
  withGw,
  assertCliBuilt,
  ensureGatewayRunning,
  setupTestSession,
  teardownTestSession,
} from '../_helpers.js';

describe('debug chat', { timeout: 180_000 }, () => {
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

  it('fails when provider is missing', async () => {
    const r = await cli(
      withGw([
        'debug', 'chat', 'start', '--client-id', clientId,
        '--provider', 'nonexistent', '--model', 'test', '-m', 'hello',
      ]),
      120_000,
    );
    assert.equal(r.exitCode, 1);
    const err = `${r.stderr}\n${r.stdout}`;
    assert.match(err, /未找到提供商|provider/i);
  });
});
