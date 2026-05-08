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
} from '../_helpers.js';

describe('debug prompt', { timeout: 180_000 }, () => {
  let clientId = '';
  let serverId = '';
  let promptId = '';
  let promptArgs = '{}';

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    const s = await setupTestSession();
    clientId = s.clientId;
    serverId = s.serverId;
  });

  after(async () => {
    await teardownTestSession({ serverId, clientId });
  });

  it('lists prompts', async () => {
    const r = await cli(withGw(['debug', 'prompt', 'list', '--client-id', clientId]), 120_000);
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
    const n = j.msg?.prompts?.length ?? 0;
    assert.ok(n > 0, 'expected prompts');
    const prompt = j.msg.prompts.find((p: { name?: string }) => typeof p.name === 'string');
    assert.ok(prompt, `expected prompt name in ${JSON.stringify(j.msg)}`);
    promptId = prompt.name;
    const args: Record<string, string> = {};
    for (const item of prompt.arguments || []) {
      if (item?.name) args[item.name] = `e2e-${item.name}`;
    }
    promptArgs = JSON.stringify(args);
  });

  it('gets a listed prompt', async () => {
    const r = await cli(
      withGw([
        'debug',
        'prompt',
        'get',
        '--client-id',
        clientId,
        '--prompt-id',
        promptId,
        '--data',
        promptArgs,
      ]),
      120_000,
    );
    assert.equal(r.exitCode, 0);
    const j = extractJson(r.stdout);
    assert.ok(j);
    assert.equal(j.code, 200);
  });
});
