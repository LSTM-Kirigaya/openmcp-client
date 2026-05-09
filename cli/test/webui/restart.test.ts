import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  ensureGatewayRunning,
  ensureWebuiStopped,
  startAndWaitWebui,
  isWebuiReachable,
  waitForWebui,
  waitForWebuiDown,
  spawnCli,
  killChild,
  webuiArgs,
  TEST_WEBUI_PORT,
} from './_helpers.js';

describe('webui restart', { timeout: 120_000 }, () => {
  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    await ensureWebuiStopped();
    await startAndWaitWebui();
  });

  after(async () => {
    await ensureWebuiStopped();
  });

  it('should restart and remain reachable', async () => {
    assert.ok(await isWebuiReachable(TEST_WEBUI_PORT), 'restart 前 WebUI 应可达');

    const child = spawnCli(webuiArgs('restart'));
    let stdout = '';
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { stdout += d.toString(); });

    // restart 先 stop 再 start；必须先等旧 webui 下线，否则
    // waitForWebui 会被旧实例骗过而立刻返回 true
    await waitForWebuiDown(TEST_WEBUI_PORT, 15_000);
    const up = await waitForWebui(TEST_WEBUI_PORT, 30_000);
    await killChild(child, false);

    assert.ok(up, 'restart 后 WebUI 应重新可达');
    assert.ok(
      stdout.includes('restarted') || stdout.includes('Restarting'),
      `restart 输出应包含确认信息，实际:\n${stdout}`,
    );
  });

  it('webui should still serve requests after restart', async () => {
    const reachable = await isWebuiReachable(TEST_WEBUI_PORT);
    assert.ok(reachable, 'restart 后健康检查应通过');
  });
});
