import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  cli,
  gatewaySerial,
  isGatewayReachable,
  waitForGateway,
  waitForGatewayDown,
  TEST_GATEWAY_PORT,
} from '../_helpers.js';

const p = String(TEST_GATEWAY_PORT);

describe('gateway restart', { timeout: 120_000 }, () => {
  before(async () => {
    await gatewaySerial(async () => {
      assertCliBuilt();
      if (await isGatewayReachable(TEST_GATEWAY_PORT)) {
        await cli(['gateway', 'stop', '-p', p]);
        await waitForGatewayDown(TEST_GATEWAY_PORT);
      }
      const r = await cli(['gateway', 'start', '-p', p]);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(await waitForGateway(TEST_GATEWAY_PORT));
    });
  });

  after(async () => {
    await gatewaySerial(async () => {
      if (await isGatewayReachable(TEST_GATEWAY_PORT)) {
        await cli(['gateway', 'stop', '-p', p]);
        await waitForGatewayDown(TEST_GATEWAY_PORT);
      }
    });
  });

  it('restarts and remains reachable', async () => {
    await gatewaySerial(async () => {
      assert.ok(await isGatewayReachable(TEST_GATEWAY_PORT));
      const r = await cli(['gateway', 'restart', '-p', p]);
      assert.equal(r.exitCode, 0, `${r.stdout}\n${r.stderr}`);
      assert.ok(await waitForGateway(TEST_GATEWAY_PORT, 30_000));
      assert.ok(await isGatewayReachable(TEST_GATEWAY_PORT));
    });
  });
});
