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
const start = ['gateway', 'start', '-p', p] as const;
const stop = ['gateway', 'stop', '-p', p] as const;

describe('gateway stop', { timeout: 120_000 }, () => {
  before(async () => {
    await gatewaySerial(async () => {
      assertCliBuilt();
      if (!(await isGatewayReachable(TEST_GATEWAY_PORT))) {
        const r = await cli([...start]);
        assert.equal(r.exitCode, 0, r.stderr);
        assert.ok(await waitForGateway(TEST_GATEWAY_PORT));
      }
    });
  });

  after(async () => {
    await gatewaySerial(async () => {
      if (await isGatewayReachable(TEST_GATEWAY_PORT)) {
        await cli([...stop]);
        await waitForGatewayDown(TEST_GATEWAY_PORT);
      }
    });
  });

  it('stops and gateway becomes unreachable', async () => {
    await gatewaySerial(async () => {
      assert.ok(await isGatewayReachable(TEST_GATEWAY_PORT));
      const r = await cli([...stop]);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(await waitForGatewayDown(TEST_GATEWAY_PORT));
      assert.equal(await isGatewayReachable(TEST_GATEWAY_PORT), false);
    });
  });

  it('handles stop when not running', async () => {
    await gatewaySerial(async () => {
      assert.equal(await isGatewayReachable(TEST_GATEWAY_PORT), false);
      const r = await cli([...stop]);
      assert.equal(r.exitCode, 0);
    });
  });
});
