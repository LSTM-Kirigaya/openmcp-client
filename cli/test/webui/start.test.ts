import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  ensureGatewayRunning,
  ensureWebuiStopped,
  startAndWaitWebui,
  isWebuiReachable,
  httpGet,
  spawnCli,
  killChild,
  waitForWebui,
  webuiArgs,
  TEST_GATEWAY_PORT,
  TEST_WEBUI_PORT,
} from './_helpers.js';

describe('webui start', { timeout: 120_000 }, () => {
  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    await ensureWebuiStopped();
  });

  after(async () => {
    await ensureWebuiStopped();
  });

  it('should start webui in background and become reachable', async () => {
    await startAndWaitWebui();

    const reachable = await isWebuiReachable(TEST_WEBUI_PORT);
    assert.ok(reachable, 'WebUI 启动后应当可达');
  });

  it('should serve health endpoint correctly', async () => {
    const { status, body } = await httpGet(TEST_WEBUI_PORT, '/__openmcp_web_health');
    assert.equal(status, 200);

    const json = JSON.parse(body);
    assert.equal(json.app, 'openmcp-web-ui');
  });

  it('should serve the main page at /mcp/', async () => {
    const { status, body } = await httpGet(TEST_WEBUI_PORT, '/mcp/');
    assert.equal(status, 200);
    assert.ok(body.includes('<html') || body.includes('<!DOCTYPE'), '/mcp/ 应返回 HTML');
  });

  it('should inject runtime websocket configuration into the static page', async () => {
    const { status, body } = await httpGet(TEST_WEBUI_PORT, '/mcp/');
    assert.equal(status, 200);
    assert.ok(
      body.includes(`window.__OPENMCP_RUNTIME_CONFIG__ = {"websocketUrl":"ws://localhost:${TEST_GATEWAY_PORT}"};`),
      '静态 WebUI 应注入运行时 Gateway WebSocket URL',
    );
  });

  it('should detect duplicate start and report already running', async () => {
    const child = spawnCli(webuiArgs('start'));
    let stdout = '';
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });

    // 等待命令产出输出（或超时）
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 8000);
      child.on('close', () => { clearTimeout(timer); resolve(); });
    });
    await killChild(child, false);

    assert.ok(
      stdout.includes('already running') || stdout.includes('已在运行'),
      `重复启动应提示已在运行，实际输出:\n${stdout}`,
    );
  });
});
