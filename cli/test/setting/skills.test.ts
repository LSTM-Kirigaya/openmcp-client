import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertCliBuilt,
  cleanupTmpFiles,
  cliWithGwReady,
  ensureGatewayRunning,
  extractJson,
} from '../_helpers.js';

describe('skills command', { timeout: 120_000, concurrency: false }, () => {
  let skillRoot = '';

  before(async () => {
    assertCliBuilt();
    await ensureGatewayRunning();
    skillRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openmcp-skills-e2e-'));
    const alphaDir = path.join(skillRoot, 'alpha');
    fs.mkdirSync(path.join(alphaDir, 'references'), { recursive: true });
    fs.writeFileSync(
      path.join(alphaDir, 'SKILL.md'),
      [
        '---',
        'name: alpha-skill',
        'description: Alpha skill for CLI E2E',
        '---',
        '',
        'Use [info](references/info.md).',
        '',
      ].join('\n'),
      'utf-8',
    );
    fs.writeFileSync(path.join(alphaDir, 'references', 'info.md'), 'alpha reference', 'utf-8');
    const set = await cliWithGwReady(['setting', 'general', 'set', 'SKILL_PATH', skillRoot]);
    assert.equal(set.exitCode, 0, `stdout:\n${set.stdout}\nstderr:\n${set.stderr}`);
  });

  after(async () => {
    await cliWithGwReady(['setting', 'general', 'set', 'SKILL_PATH', '']).catch(() => {});
    if (skillRoot) fs.rmSync(skillRoot, { recursive: true, force: true });
    cleanupTmpFiles();
  });

  it('lists skills from SKILL_PATH', async () => {
    const r = await cliWithGwReady(['skills', 'list']);
    assert.equal(r.exitCode, 0, r.stderr);
    const j = extractJson(r.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
    assert.ok(
      j.msg?.skills?.some((skill: { name?: string }) => skill.name === 'alpha-skill'),
      JSON.stringify(j),
    );
  });

  it('loads a skill by frontmatter name', async () => {
    const r = await cliWithGwReady(['skills', 'load', '--skill-name', 'alpha-skill']);
    assert.equal(r.exitCode, 0, r.stderr);
    const j = extractJson(r.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
    assert.equal(j.msg?.name, 'alpha-skill');
    assert.match(j.msg?.body || '', /Use/);
  });

  it('reads a referenced file for the requested skill', async () => {
    const r = await cliWithGwReady([
      'skills',
      'read-file',
      '--skill-name',
      'alpha-skill',
      '--file-path',
      'references/info.md',
    ]);
    assert.equal(r.exitCode, 0, r.stderr);
    const j = extractJson(r.stdout);
    assert.equal(j?.code, 200, JSON.stringify(j));
    assert.equal(j.msg?.isError, false, JSON.stringify(j));
    assert.match(j.msg?.content?.[0]?.text || '', /alpha reference/);
  });
});
