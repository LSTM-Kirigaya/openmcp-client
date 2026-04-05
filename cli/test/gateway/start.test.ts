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

async function ensureDown() {
  if (await isGatewayReachable(TEST_GATEWAY_PORT)) {
    await cli([...stop]);
    await waitForGatewayDown(TEST_GATEWAY_PORT);
  }
}

describe('gateway start', { timeout: 120_000 }, () => {
  before(async () => {
    await gatewaySerial(async () => {
      assertCliBuilt();
      await ensureDown();
    });
  });

  after(async () => {
    await gatewaySerial(async () => {
      await ensureDown();
    });
  });

  it('starts and becomes reachable', async () => {
    await gatewaySerial(async () => {
      const r = await cli([...start]);
      assert.equal(r.exitCode, 0, r.stderr);
      assert.ok(await waitForGateway(TEST_GATEWAY_PORT));
      assert.ok(await isGatewayReachable(TEST_GATEWAY_PORT));
    });
  });

  it('second start reports already running', async () => {
    await gatewaySerial(async () => {
      const r = await cli([...start]);
      assert.equal(r.exitCode, 0);
      assert.ok(
        /already running|already reachable/i.test(r.stdout),
        r.stdout,
      );
    });
  });
});
