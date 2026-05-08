import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertCliBuilt, cli, CLI_ROOT } from '../_helpers.js';

const HELP_COMMANDS: string[][] = [
  ['--help'],
  ['setting', '--help'],
  ['setting', 'general', '--help'],
  ['setting', 'llm', '--help'],
  ['setting', 'llm', 'provider', '--help'],
  ['setting', 'llm', 'model', '--help'],
  ['mcp', '--help'],
  ['mcp', 'server', '--help'],
  ['mcp', 'session', '--help'],
  ['debug', '--help'],
  ['debug', 'tool', '--help'],
  ['debug', 'tool', 'test-case', '--help'],
  ['debug', 'resource', '--help'],
  ['debug', 'prompt', '--help'],
  ['debug', 'mcp', '--help'],
  ['debug', 'mcp', 'config', '--help'],
  ['debug', 'mcp', 'history', '--help'],
  ['debug', 'batch', '--help'],
  ['debug', 'chat', '--help'],
  ['gateway', '--help'],
  ['webui', '--help'],
  ['start', '--help'],
  ['skills', '--help'],
];

describe('cli surface', { timeout: 120_000 }, () => {
  before(() => {
    assertCliBuilt();
  });

  for (const args of HELP_COMMANDS) {
    it(`help: openmcp ${args.join(' ')}`, async () => {
      const r = await cli(args);
      assert.equal(r.exitCode, 0, `stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);
      assert.match(r.stdout, /Usage: openmcp/);
    });
  }

  it('version matches cli/package.json', async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(CLI_ROOT, 'package.json'), 'utf-8'));
    const r = await cli(['--version']);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.equal(r.stdout.trim(), pkg.version);
  });

  it('top-level help exposes skills and no stale debug tool run example', async () => {
    const r = await cli(['--help']);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.match(r.stdout, /\bskills\b/);
    assert.doesNotMatch(r.stdout, /debug tool run/);
  });

  it('docs do not mention removed top-level command examples', () => {
    const docs = [
      'README.md',
      'docs/usage.md',
      'docs/commands.md',
      'docs/development.md',
      'src/lib/help-text.ts',
    ].map((p) => fs.readFileSync(path.join(CLI_ROOT, p), 'utf-8')).join('\n');

    for (const pattern of [
      /debug tool run/,
      /openmcp mcp tools-list/,
      /openmcp mcp tools-call/,
      /openmcp mcp connect/,
      /openmcp mcp sessions/,
      /openmcp connection /,
      /openmcp test-case /,
      /openmcp validation-suite /,
      /openmcp validation /,
      /openmcp llm chat-sync/,
    ]) {
      assert.doesNotMatch(docs, pattern);
    }
  });
});
