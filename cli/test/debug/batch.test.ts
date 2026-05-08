import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  cli,
  withGw,
  assertCliBuilt,
  ensureGatewayRunning,
  setupTestSession,
  teardownTestSession,
  extractJson,
  cleanupTmpFiles,
  startFakeOpenAiServer,
  type FakeOpenAiServer,
} from '../_helpers.js';

function suiteBody(id: string) {
  return JSON.stringify({
    id,
    name: `suite ${id}`,
    description: 'test desc',
    storage: {
      testCases: [
        {
          id: 'case-1',
          input: 'hello',
          criteria: ['contains greeting'],
        },
      ],
      selectedCaseIndex: 0,
      comprehensiveSelectedIndices: [],
      comprehensivePresets: [],
      sourceTabIndex: 0,
      evaluationMode: 'pass-fail',
      resultGroups: [],
    },
  });
}

describe('debug batch', { timeout: 180_000 }, () => {
  let clientId = '';
  let serverId = '';
  let workspaceDir = '';
  let fake: FakeOpenAiServer;

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    fake = await startFakeOpenAiServer();
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmcp-batch-e2e-'));
    const s = await setupTestSession();
    clientId = s.clientId;
    serverId = s.serverId;
  });

  after(async () => {
    await teardownTestSession({ serverId, clientId });
    await fake?.close();
    if (workspaceDir) fs.rmSync(workspaceDir, { recursive: true, force: true });
    cleanupTmpFiles();
  });

  it('save/list/get/delete validation suite in user scope', async () => {
    const suiteId = `e2e-suite-user-${Date.now()}`;
    const save = await cli(
      withGw(['debug', 'batch', 'save', '--data', suiteBody(suiteId), '--client-id', clientId]),
      120_000,
    );
    assert.equal(save.exitCode, 0, `stdout:\n${save.stdout}\nstderr:\n${save.stderr}`);
    const sj = extractJson(save.stdout);
    assert.equal(sj?.data?.id, suiteId, JSON.stringify(sj));

    const list = await cli(withGw(['debug', 'batch', 'list', '--client-id', clientId]), 120_000);
    assert.equal(list.exitCode, 0, list.stderr);
    assert.match(list.stdout, new RegExp(suiteId));

    const get = await cli(
      withGw(['debug', 'batch', 'get', '--suite-id', suiteId, '--client-id', clientId]),
      120_000,
    );
    assert.equal(get.exitCode, 0, get.stderr);
    const gj = extractJson(get.stdout);
    assert.equal(gj?.data?.id, suiteId, JSON.stringify(gj));

    const del = await cli(
      withGw(['debug', 'batch', 'delete', '--suite-id', suiteId, '--client-id', clientId]),
      120_000,
    );
    assert.equal(del.exitCode, 0, del.stderr);
  });

  it('save/list/get/delete validation suite in workspace scope', async () => {
    const suiteId = `e2e-suite-workspace-${Date.now()}`;
    const scoped = ['--scope', 'workspace', '--workspace', workspaceDir, '--client-id', clientId];
    const save = await cli(
      withGw(['debug', 'batch', 'save', ...scoped, '--data', suiteBody(suiteId)]),
      120_000,
    );
    assert.equal(save.exitCode, 0, `stdout:\n${save.stdout}\nstderr:\n${save.stderr}`);
    const sj = extractJson(save.stdout);
    assert.equal(sj?.data?.id, suiteId, JSON.stringify(sj));

    const list = await cli(withGw(['debug', 'batch', 'list', ...scoped]), 120_000);
    assert.equal(list.exitCode, 0, list.stderr);
    assert.match(list.stdout, new RegExp(suiteId));

    const get = await cli(withGw(['debug', 'batch', 'get', ...scoped, '--suite-id', suiteId]), 120_000);
    assert.equal(get.exitCode, 0, get.stderr);
    const gj = extractJson(get.stdout);
    assert.equal(gj?.data?.id, suiteId, JSON.stringify(gj));

    const del = await cli(withGw(['debug', 'batch', 'delete', ...scoped, '--suite-id', suiteId]), 120_000);
    assert.equal(del.exitCode, 0, del.stderr);
  });

  it('run pass-fail validation against fake LLM', async () => {
    const body = JSON.stringify({
      messages: [{ role: 'assistant', content: 'The result is correct.' }],
      testCases: [{ id: 'pass-case', expectedCriteria: 'The result should be correct.' }],
      evaluationMode: 'pass-fail',
      llmConfig: { baseURL: fake.baseUrl, apiKey: 'sk-fake', model: 'fake-judge' },
    });
    const r = await cli(withGw(['debug', 'batch', 'run', '--data', body]), 120_000);
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    const j = extractJson(r.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
    assert.equal(j.msg?.results?.[0]?.pass, true, JSON.stringify(j));
  });

  it('run score validation against fake LLM', async () => {
    const body = JSON.stringify({
      messages: [{ role: 'assistant', content: 'The result is mostly correct.' }],
      testCases: [{ id: 'score-case', expectedCriteria: 'Score this result.' }],
      evaluationMode: 'score',
      llmConfig: { baseURL: fake.baseUrl, apiKey: 'sk-fake', model: 'fake-judge' },
    });
    const r = await cli(withGw(['debug', 'batch', 'run', '--data', body]), 120_000);
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    const j = extractJson(r.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
    assert.equal(j.msg?.results?.[0]?.score, 8, JSON.stringify(j));
  });
});
