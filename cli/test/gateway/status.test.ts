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

describe('gateway status', { timeout: 120_000 }, () => {
  before(async () => {
    await gatewaySerial(async () => {
      assertCliBuilt();
      if (await isGatewayReachable(TEST_GATEWAY_PORT)) {
        await cli(['gateway', 'stop', '-p', p]);
        await waitForGatewayDown(TEST_GATEWAY_PORT);
      }
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

  it('shows Not Running when stopped', async () => {
    await gatewaySerial(async () => {
      const r = await cli(['gateway', 'status', '-p', p]);
      assert.equal(r.exitCode, 0);
      assert.ok(r.stdout.includes('Not Running'));
    });
  });

  it('shows Running after start', async () => {
    await gatewaySerial(async () => {
      const sr = await cli(['gateway', 'start', '-p', p]);
      assert.equal(sr.exitCode, 0);
      assert.ok(await waitForGateway(TEST_GATEWAY_PORT));
      const r = await cli(['gateway', 'status', '-p', p]);
      assert.equal(r.exitCode, 0);
      assert.ok(r.stdout.includes('Running'));
    });
  });
});
