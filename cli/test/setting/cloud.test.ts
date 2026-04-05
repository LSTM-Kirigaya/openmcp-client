import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  ensureGatewayRunning,
  cliWithGwReady,
} from '../_helpers.js';

describe('setting cloud', { timeout: 120_000 }, () => {
  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
  });

  it('status without login: exit 0', async () => {
    const r = await cliWithGwReady(['setting', 'cloud', 'status']);
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  });

  it('get-token without login: exit 0, no crash', async () => {
    const r = await cliWithGwReady(['setting', 'cloud', 'get-token']);
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  });
});
