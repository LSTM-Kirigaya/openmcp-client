import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  cli,
  gatewaySerial,
  spawnCli,
  killChild,
  isGatewayReachable,
  waitForGateway,
  waitForGatewayDown,
  TEST_GATEWAY_PORT,
} from '../_helpers.js';

const p = String(TEST_GATEWAY_PORT);

describe('gateway run', { timeout: 120_000 }, () => {
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

  it('foreground process serves until killed', async () => {
    await gatewaySerial(async () => {
      const child = spawnCli(['gateway', 'run', '-p', p]);
      assert.ok(await waitForGateway(TEST_GATEWAY_PORT));
      assert.ok(await isGatewayReachable(TEST_GATEWAY_PORT));
      await killChild(child);
      await waitForGatewayDown(TEST_GATEWAY_PORT);
    });
  });
});
