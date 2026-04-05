import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  cli,
  ensureGatewayRunning,
  ensureWebuiStopped,
  startAndWaitWebui,
  isWebuiReachable,
  waitForWebuiDown,
  webuiArgs,
  TEST_WEBUI_PORT,
} from './_helpers.js';

describe('webui stop', { timeout: 120_000 }, () => {
  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    await ensureWebuiStopped();
  });

  after(async () => {
    await ensureWebuiStopped();
  });

  it('should stop a running webui', async () => {
    await startAndWaitWebui();
    assert.ok(await isWebuiReachable(TEST_WEBUI_PORT), '停止前 WebUI 应可达');

    const result = await cli(webuiArgs('stop'));
    assert.equal(result.exitCode, 0, `stop 退出码异常: ${result.stderr}`);

    const down = await waitForWebuiDown(TEST_WEBUI_PORT);
    assert.ok(down, '执行 stop 后 WebUI 应不再可达');
  });

  it('should handle stop gracefully when nothing is running', async () => {
    assert.ok(
      !(await isWebuiReachable(TEST_WEBUI_PORT)),
      '此测试开始时 WebUI 应已停止',
    );

    const result = await cli(webuiArgs('stop'));
    // 即使没有正在运行的实例，也不应崩溃
    assert.equal(result.exitCode, 0, '无实例运行时 stop 不应崩溃');
    assert.ok(
      result.stdout.includes('No Renderer PID') ||
      result.stdout.includes('not running') ||
      result.stdout.includes('Stopping'),
      `应输出相关提示，实际输出:\n${result.stdout}`,
    );
  });
});
