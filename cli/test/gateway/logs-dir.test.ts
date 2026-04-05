import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { assertCliBuilt, cli, gatewaySerial } from '../_helpers.js';

describe('gateway logs-dir', { timeout: 120_000 }, () => {
  before(async () => {
    await gatewaySerial(async () => {
      assertCliBuilt();
    });
  });

  it('prints a path on stdout', async () => {
    await gatewaySerial(async () => {
      const r = await cli(['gateway', 'logs-dir']);
      assert.equal(r.exitCode, 0);
      const out = r.stdout.trim();
      assert.ok(out.length > 0);
      assert.ok(/[\\/]/.test(out) || /^[A-Za-z]:/.test(out));
    });
  });
});
