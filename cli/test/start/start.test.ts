import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  cli,
  spawnCli,
  killChild,
  isGatewayReachable,
  isWebuiReachable,
  waitForGateway,
  waitForWebui,
  waitForGatewayDown,
  waitForWebuiDown,
  TEST_GATEWAY_PORT,
  TEST_WEBUI_PORT,
} from '../_helpers.js';

const GP = String(TEST_GATEWAY_PORT);
const WP = String(TEST_WEBUI_PORT);

async function ensureAllDown() {
  if (await isWebuiReachable(TEST_WEBUI_PORT)) {
    await cli(['webui', 'stop', '-p', WP]);
    await waitForWebuiDown(TEST_WEBUI_PORT);
  }
  if (await isGatewayReachable(TEST_GATEWAY_PORT)) {
    await cli(['gateway', 'stop', '-p', GP]);
    await waitForGatewayDown(TEST_GATEWAY_PORT);
  }
}

describe('openmcp-cli start (gateway + webui)', { timeout: 120_000 }, () => {
  before(async () => {
    assertCliBuilt();
    await ensureAllDown();
  });

  after(async () => {
    await ensureAllDown();
  });

  it('should start both gateway and webui', async () => {
    const child = spawnCli(['start', '-p', WP, '-g', GP]);
    let stdout = '';
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });

    const gwUp = await waitForGateway(TEST_GATEWAY_PORT);
    assert.ok(gwUp, 'Gateway 应可达');

    const webUp = await waitForWebui(TEST_WEBUI_PORT, 30_000);
    await killChild(child);

    assert.ok(webUp, 'WebUI 应可达');
    assert.ok(stdout.includes('OpenMCP'), '输出应包含 OpenMCP 标识');
  });
});
