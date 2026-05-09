import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  cli,
  withGw,
  assertCliBuilt,
  ensureGatewayRunning,
  setupTestSession,
  teardownTestSession,
  startFakeOpenAiServer,
  type FakeOpenAiServer,
  extractJson,
} from '../_helpers.js';

describe('debug chat', { timeout: 180_000 }, () => {
  let clientId = '';
  let serverId = '';
  let fake: FakeOpenAiServer;

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    fake = await startFakeOpenAiServer();
    await cli(withGw(['setting', 'llm', 'provider', 'delete', '--id', 'debug-chat-fake-e2e']));
    const add = await cli(withGw([
      'setting',
      'llm',
      'provider',
      'add',
      '--id',
      'debug-chat-fake-e2e',
      '--name',
      'Debug Chat Fake',
      '--base-url',
      fake.baseUrl,
      '--api-key',
      'sk-fake',
    ]));
    assert.equal(add.exitCode, 0, `stdout:\n${add.stdout}\nstderr:\n${add.stderr}`);
    const s = await setupTestSession();
    clientId = s.clientId;
    serverId = s.serverId;
  });

  after(async () => {
    await teardownTestSession({ serverId, clientId });
    await cli(withGw(['setting', 'llm', 'provider', 'delete', '--id', 'debug-chat-fake-e2e'])).catch(() => {});
    await fake?.close();
  });

  it('fails when provider is missing', async () => {
    const r = await cli(
      withGw([
        'debug', 'chat', 'start', '--client-id', clientId,
        '--provider', 'nonexistent', '--model', 'test', '-m', 'hello',
      ]),
      120_000,
    );
    assert.equal(r.exitCode, 1);
    const err = `${r.stderr}\n${r.stdout}`;
    assert.match(err, /未找到提供商|provider/i);
  });

  it('runs an MCP-aware chat with a fake provider', async () => {
    const r = await cli(
      withGw([
        'debug', 'chat', 'start', '--client-id', clientId,
        '--provider', 'debug-chat-fake-e2e', '--model', 'fake-judge', '-m', 'hello',
      ]),
      120_000,
    );
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    const j = extractJson(r.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
    assert.equal(j.msg?.response, 'fake chat ok', JSON.stringify(j));
    assert.ok(Array.isArray(j.msg?.trace), JSON.stringify(j));
    assert.ok(
      j.msg.trace.some((m: any) => m?.role === 'assistant' && String(m?.content ?? '').includes('fake chat ok')),
      JSON.stringify(j),
    );
    assert.equal(j.msg?.results, undefined, JSON.stringify(j));
    assert.equal(j.msg?.validation, undefined, JSON.stringify(j));
  });

  it('can validate a generated chat trace when requested', async () => {
    const r = await cli(
      withGw([
        'debug', 'chat', 'start', '--client-id', clientId,
        '--provider', 'debug-chat-fake-e2e', '--model', 'fake-judge', '-m', 'hello', '--validate',
      ]),
      120_000,
    );
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    const j = extractJson(r.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
    assert.equal(j.msg?.response, 'fake chat ok', JSON.stringify(j));
    assert.equal(j.msg?.results?.[0]?.pass, true, JSON.stringify(j));
  });
});
