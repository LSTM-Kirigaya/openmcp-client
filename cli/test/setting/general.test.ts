import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  ensureGatewayRunning,
  cliWithGwReady,
  cleanupTmpFiles,
} from '../_helpers.js';

describe('setting general', { timeout: 120_000, concurrency: false }, () => {
  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
  });

  after(() => {
    cleanupTmpFiles();
  });

  it('list: exit 0 and stdout contains LANG or MCP_TIMEOUT_SEC', async () => {
    const r = await cliWithGwReady(['setting', 'general', 'list']);
    assert.equal(r.exitCode, 0, `stderr:\n${r.stderr}`);
    assert.ok(
      r.stdout.includes('LANG') || r.stdout.includes('MCP_TIMEOUT_SEC'),
      `expected LANG or MCP_TIMEOUT_SEC in:\n${r.stdout}`,
    );
  });

  it('set MCP_TIMEOUT_SEC to 120, verify in list, then restore to 30', async () => {
    try {
      const setR = await cliWithGwReady(['setting', 'general', 'set', 'MCP_TIMEOUT_SEC', '120']);
      assert.equal(setR.exitCode, 0, `stdout:\n${setR.stdout}\nstderr:\n${setR.stderr}`);

      const listR = await cliWithGwReady(['setting', 'general', 'list']);
      assert.equal(listR.exitCode, 0, listR.stderr);
      assert.ok(
        listR.stdout.includes('120'),
        `expected 120 in list output:\n${listR.stdout}`,
      );
    } finally {
      await ensureGatewayRunning();
      const restore = await cliWithGwReady(['setting', 'general', 'set', 'MCP_TIMEOUT_SEC', '30']);
      assert.equal(
        restore.exitCode,
        0,
        `restore failed:\n${restore.stdout}\n${restore.stderr}`,
      );
    }
  });
});
