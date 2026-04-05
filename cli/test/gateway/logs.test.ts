import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { assertCliBuilt, cli, gatewaySerial } from '../_helpers.js';

describe('gateway logs', { timeout: 120_000 }, () => {
  before(async () => {
    await gatewaySerial(async () => {
      assertCliBuilt();
    });
  });

  it('exits 0', async () => {
    await gatewaySerial(async () => {
      const r = await cli(['gateway', 'logs']);
      assert.equal(r.exitCode, 0);
    });
  });
});
