import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  cli,
  ensureGatewayRunning,
  ensureWebuiStopped,
  startAndWaitWebui,
  webuiArgs,
  TEST_WEBUI_PORT,
} from './_helpers.js';

describe('webui status', { timeout: 120_000 }, () => {
  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    await ensureWebuiStopped();
  });

  after(async () => {
    await ensureWebuiStopped();
  });

  it('should report "Not Running" when webui is stopped', async () => {
    const result = await cli(webuiArgs('status'));
    assert.equal(result.exitCode, 0);
    assert.ok(
      result.stdout.includes('Not Running') || result.stdout.includes('❌'),
      `未运行时应显示 Not Running，实际:\n${result.stdout}`,
    );
  });

  it('should report gateway as reachable', async () => {
    const result = await cli(webuiArgs('status'));
    assert.ok(
      result.stdout.includes('Reachable') || result.stdout.includes('✅'),
      `Gateway 正在运行，status 应显示 Reachable，实际:\n${result.stdout}`,
    );
  });

  it('should report "Running" after webui starts', async () => {
    await startAndWaitWebui();

    const result = await cli(webuiArgs('status'));
    assert.equal(result.exitCode, 0);
    assert.ok(
      result.stdout.includes('Running') && !result.stdout.includes('Not Running'),
      `启动后 status 应显示 Running，实际:\n${result.stdout}`,
    );
  });

  it('should show correct port in status output', async () => {
    const result = await cli(webuiArgs('status'));
    assert.ok(
      result.stdout.includes(String(TEST_WEBUI_PORT)),
      `status 输出应包含端口 ${TEST_WEBUI_PORT}`,
    );
  });
});
