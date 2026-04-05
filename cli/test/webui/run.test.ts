import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  ensureGatewayRunning,
  ensureWebuiStopped,
  spawnCli,
  killChild,
  isWebuiReachable,
  waitForWebui,
  waitForWebuiDown,
  webuiArgs,
  sleep,
  TEST_WEBUI_PORT,
} from './_helpers.js';

describe('webui run (foreground)', { timeout: 120_000 }, () => {
  let runChild: ReturnType<typeof spawnCli> | null = null;

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    await ensureWebuiStopped();
  });

  after(async () => {
    if (runChild) {
      await killChild(runChild);
      runChild = null;
    }
    await ensureWebuiStopped();
  });

  it('should run webui in foreground and become reachable', async () => {
    runChild = spawnCli(webuiArgs('run'));

    let stdout = '';
    runChild.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });

    const up = await waitForWebui(TEST_WEBUI_PORT, 30_000);
    assert.ok(up, 'run 模式下 WebUI 应可达');
    assert.ok(
      stdout.includes('Web UI') || stdout.includes('OpenMCP'),
      `run 输出应包含启动信息，实际:\n${stdout}`,
    );
  });

  it('should stop serving after process is killed', async () => {
    assert.ok(runChild, '前一个测试应已创建 runChild');

    await killChild(runChild!);
    runChild = null;

    // 给操作系统一点时间回收端口
    await sleep(2000);

    // 进程树被杀后，webui 可能需要一点时间才不可达
    const down = await waitForWebuiDown(TEST_WEBUI_PORT, 10_000);
    assert.ok(down, '终止前台进程后 WebUI 应不再可达');
  });
});
