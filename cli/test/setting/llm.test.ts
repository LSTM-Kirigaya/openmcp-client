import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCliBuilt,
  ensureGatewayRunning,
  cliWithGwReady,
} from '../_helpers.js';

describe('setting llm provider', { timeout: 120_000, concurrency: false }, () => {
  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    // 上次运行中断时可能残留同名 provider，先删再测以保证 add 可重复执行
    await cliWithGwReady(['setting', 'llm', 'provider', 'delete', '--id', 'test-provider-e2e']);
  });

  after(async () => {
    await cliWithGwReady(['setting', 'llm', 'provider', 'delete', '--id', 'test-provider-e2e']).catch(
      () => {},
    );
  });

  it('provider add: exit 0 and 已添加', async () => {
    const r = await cliWithGwReady([
      'setting',
      'llm',
      'provider',
      'add',
      '--id',
      'test-provider-e2e',
      '--name',
      'Test Provider E2E',
      '--base-url',
      'https://api.test.com/v1',
      '--api-key',
      'sk-test-key-123',
    ]);
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    assert.ok(r.stdout.includes('已添加'), r.stdout);
  });

  it('provider list: contains test-provider-e2e', async () => {
    const r = await cliWithGwReady(['setting', 'llm', 'provider', 'list']);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.ok(r.stdout.includes('test-provider-e2e'), r.stdout);
  });

  it('provider update: exit 0', async () => {
    const r = await cliWithGwReady([
      'setting',
      'llm',
      'provider',
      'update',
      '--id',
      'test-provider-e2e',
      '--name',
      'Updated Name',
      '--base-url',
      'https://api.updated.com/v1',
    ]);
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  });

  it('provider list after update: Updated Name and api.updated.com', async () => {
    const r = await cliWithGwReady(['setting', 'llm', 'provider', 'list']);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.ok(r.stdout.includes('Updated Name'), r.stdout);
    assert.ok(r.stdout.includes('api.updated.com'), r.stdout);
  });

  it('provider delete: exit 0 and 已删除', async () => {
    const r = await cliWithGwReady(['setting', 'llm', 'provider', 'delete', '--id', 'test-provider-e2e']);
    assert.equal(r.exitCode, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    assert.ok(r.stdout.includes('已删除'), r.stdout);
  });

  it('provider list after delete: no test-provider-e2e', async () => {
    const r = await cliWithGwReady(['setting', 'llm', 'provider', 'list']);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.ok(!r.stdout.includes('test-provider-e2e'), r.stdout);
  });
});
