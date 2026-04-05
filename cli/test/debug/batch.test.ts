import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  cli,
  withGw,
  assertCliBuilt,
  ensureGatewayRunning,
  setupTestSession,
  teardownTestSession,
  extractJson,
  cleanupTmpFiles,
} from '../_helpers.js';

describe('debug batch', { timeout: 180_000 }, () => {
  let clientId = '';
  let serverId = '';
  let suiteId: string | undefined;

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    const s = await setupTestSession();
    clientId = s.clientId;
    serverId = s.serverId;
  });

  after(async () => {
    await teardownTestSession({ serverId, clientId });
    cleanupTmpFiles();
  });

  it('save list delete validation suite', async () => {
    const data = JSON.stringify({
      id: `e2e-suite-${Date.now()}`,
      name: 'e2e-test-suite',
      description: 'test desc',
      testCases: [],
    });
    const save = await cli(withGw(['debug', 'batch', 'save', '--data', data, '--client-id', clientId]), 120_000);
    assert.equal(save.exitCode, 0);
    const sj = extractJson(save.stdout);
    suiteId = sj?.data?.id;
    assert.ok(suiteId);

    const list = await cli(withGw(['debug', 'batch', 'list', '--client-id', clientId]), 120_000);
    assert.equal(list.exitCode, 0);
    const lj = extractJson(list.stdout);
    assert.ok(lj);
    assert.equal(lj.code, 200);

    const del = await cli(
      withGw(['debug', 'batch', 'delete', '--suite-id', suiteId!, '--client-id', clientId]),
      120_000,
    );
    assert.equal(del.exitCode, 0);
  });
});
