import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { resolveConfig } from '../src/config.js';
import { scoreContext } from '../src/score.js';
import type { InputFile } from '../src/types.js';

const config = resolveConfig();

function pack(files: InputFile[], kind: 'single' | 'pack' = 'pack') {
  return scoreContext({ files, config, kind, rootLabel: 'memory' });
}

test('relevance penalises an equal-sized lockfile to 50', async () => {
  const signal = 'S'.repeat(500);
  const lock = 'L'.repeat(500);
  const report = await pack([
    { path: 'src/a.ts', content: signal, mtimeMs: 1 },
    { path: 'package-lock.json', content: lock, mtimeMs: 1 },
  ]);
  const relevance = report.dimensions.find((dimension) => dimension.id === 'relevance');
  assert.ok(relevance);
  assert.equal(relevance.score, 50);
  assert.equal(relevance.details.noiseFiles, 1);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'relevance/lockfile'));
});

test('duplicate copies keep the source path and flag the notes copy', async () => {
  const content = 'export function shared() {\n  return 1;\n}\n';
  const report = await pack([
    { path: 'src/util.ts', content, mtimeMs: 1 },
    { path: 'notes/duplicate.ts', content, mtimeMs: 1 },
  ]);
  const duplicate = report.findings.find((finding) => finding.ruleId === 'relevance/duplicate');
  assert.ok(duplicate);
  assert.equal(duplicate.file, 'notes/duplicate.ts');
  assert.equal(duplicate.data?.canonical, 'src/util.ts');
});

test('freshness uses embedded dates and only lightly penalises an extra stale doc', async () => {
  const report = await pack([
    {
      path: 'README.md',
      content: '# Pack\n\nLast updated: 2026-11-01\n\n## API\n\n```\nnpm test\n```\n',
      mtimeMs: 0,
    },
    {
      path: 'docs/legacy.md',
      content: 'Last updated: 2025-06-01\n\nSee [gone](./missing.md)\n',
      mtimeMs: 0,
    },
    {
      path: 'src/index.ts',
      content: '/**\n * @modified 2026-11-01\n */\nexport function hi() {\n  return 1;\n}\n',
      mtimeMs: 0,
    },
  ]);
  const freshness = report.dimensions.find((dimension) => dimension.id === 'freshness');
  const completeness = report.dimensions.find((dimension) => dimension.id === 'completeness');
  assert.equal(freshness?.score, 92);
  assert.equal(completeness?.score, 92);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'freshness/stale-doc' && finding.file === 'docs/legacy.md'));
  assert.ok(report.findings.some((finding) => finding.ruleId === 'completeness/broken-ref'));
  assert.equal(report.findings.some((finding) => finding.ruleId === 'completeness/missing-interface'), false);
});

test('a multi-file pack without a README loses completeness points', async () => {
  const report = await pack([
    { path: 'src/index.ts', content: 'export function hi() { return 1; }\n', mtimeMs: 1 },
  ]);
  const completeness = report.dimensions.find((dimension) => dimension.id === 'completeness');
  assert.ok(completeness);
  assert.ok(completeness.score <= 70);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'completeness/missing-readme'));
  assert.ok(report.findings.some((finding) => finding.ruleId === 'completeness/missing-interface'));
});

test('a single prompt does not require a README', async () => {
  const content = [
    '# Task',
    '',
    '## Goal',
    '',
    'Fix the retry helper without adding dependencies.',
    '',
    '## Constraints',
    '',
    '- Keep the public signature.',
    '',
    '## Context',
    '',
    '```ts',
    'export function retry() {}',
    '```',
    '',
  ].join('\n');
  const report = await pack([{ path: 'prompt.md', content, mtimeMs: 1 }], 'single');
  assert.equal(report.findings.some((finding) => finding.ruleId === 'completeness/missing-readme'), false);
  assert.equal(report.dimensions.find((dimension) => dimension.id === 'freshness')?.score, 80);
  const structure = report.dimensions.find((dimension) => dimension.id === 'structure');
  assert.ok(structure);
  assert.ok(structure.score >= 80);
});

test('repeated banners lower token efficiency and suggest a deletion', async () => {
  const banner = '/* context-pack header: generated for agent sessions — keep this banner so the pack is attributable */';
  const report = await pack([1, 2, 3, 4].map((n) => ({
    path: `src/file-${n}.ts`,
    content: `${banner}\nexport function f${n}() { return ${n}; }\n`,
    mtimeMs: 1,
  })));
  const tokens = report.dimensions.find((dimension) => dimension.id === 'tokens');
  assert.ok(tokens);
  assert.ok(tokens.score < 100);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'tokens/boilerplate'));
  assert.ok(report.suggestions.some((suggestion) => suggestion.ruleId === 'tokens/boilerplate'));
});

test('a full structure pack scores 100 and a thin one does not', async () => {
  const rich = await pack([
    {
      path: 'README.md',
      content: '# Title\n\n## Start\n\n```\nnpm test\n```\n\n## API\n\nUse `run`.\n',
      mtimeMs: 1,
    },
    {
      path: 'src/index.ts',
      content: '/** Run it. */\nexport function run() { return 1; }\n',
      mtimeMs: 1,
    },
    { path: 'package.json', content: '{"main":"src/index.ts"}\n', mtimeMs: 1 },
    { path: 'AGENTS.md', content: '# Agents\n\nStay in src/.\n', mtimeMs: 1 },
  ]);
  assert.equal(rich.dimensions.find((dimension) => dimension.id === 'structure')?.score, 100);

  const thin = await pack([
    { path: 'lib/worker.py', content: 'def run():\n    return 1\n', mtimeMs: 1 },
  ]);
  assert.ok((thin.dimensions.find((dimension) => dimension.id === 'structure')?.score ?? 100) < 80);
});

test('custom weights change the overall score', async () => {
  const files: InputFile[] = [
    { path: 'README.md', content: '# Pack\n\nLast updated: 2026-11-01\n\n## API\n\n```\nok\n```\n', mtimeMs: 1 },
    { path: 'src/index.ts', content: '/** @modified 2026-11-01 */\nexport function hi(){return 1}\n', mtimeMs: 1 },
    { path: '.env', content: `API_KEY=${'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyz'}\n`, mtimeMs: 1 },
  ];
  const normal = await scoreContext({ files, config, kind: 'pack' });
  const ignoreSecrets = await scoreContext({
    files,
    kind: 'pack',
    config: resolveConfig({ weights: { secrets: 0 } }),
  });
  assert.ok(ignoreSecrets.overall > normal.overall);
});

test('an empty directory scores 0 and does not pass', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cqs-empty-'));
  const report = await scoreContext({ cwd: dir, paths: [dir], config });
  assert.equal(report.filesScanned, 0);
  assert.equal(report.overall, 0);
  assert.equal(report.passed, false);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'pack/empty'));
});

test('default ignores skip node_modules while walking a repository', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cqs-walk-'));
  mkdirSync(path.join(dir, 'src'));
  mkdirSync(path.join(dir, 'node_modules', 'leftpad'), { recursive: true });
  writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const ready = true;\n');
  writeFileSync(path.join(dir, 'node_modules', 'leftpad', 'index.js'), 'module.exports = (s, n) => s;\n');
  const report = await scoreContext({ cwd: dir, paths: [dir], config });
  assert.equal(report.filesScanned, 1);
  assert.equal(report.findings.some((finding) => finding.file?.includes('node_modules')), false);
});

test('the LLM hook is off by default and cannot change the score', async () => {
  const files: InputFile[] = [
    { path: 'README.md', content: '# Pack\n\nLast updated: 2026-11-01\n\n## Use\n\n```\nok\n```\n', mtimeMs: 1 },
    { path: 'src/index.ts', content: '/** @modified 2026-11-01 */\nexport function hi(){return 1}\n', mtimeMs: 1 },
  ];
  let called = false;
  const disabled = await scoreContext({
    files,
    config,
    kind: 'pack',
    llmReviewer: () => {
      called = true;
      return ['should not be stored'];
    },
  });
  assert.equal(called, false);
  assert.equal(disabled.llm.enabled, false);
  assert.equal(disabled.llm.executed, false);

  const secretNote = `leak ${'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyz'}`;
  const enabled = await scoreContext({
    files,
    kind: 'pack',
    config: resolveConfig({ llm: { enabled: true, command: 'echo cqs-should-not-spawn' } }),
    llmReviewer: () => [secretNote, 'Prefer the typed entrypoint.'],
  });
  const untouched = await scoreContext({
    files,
    kind: 'pack',
    config: resolveConfig({ llm: { enabled: true, command: 'echo cqs-should-not-spawn' } }),
  });
  assert.equal(enabled.overall, untouched.overall);
  assert.equal(enabled.llm.executed, true);
  assert.equal(untouched.llm.executed, false);
  assert.match(untouched.llm.notes[0] ?? '', /did not execute/);
  assert.equal(enabled.llm.notes[0], '[llm note redacted because it contained a credential-like pattern]');
  assert.equal(enabled.llm.notes.includes(secretNote), false);
});
