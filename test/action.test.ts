import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';

import { repoRoot } from './helpers.js';

function readYaml(relative: string): Record<string, unknown> {
  const file = path.join(repoRoot, relative);
  const parsed: unknown = parse(readFileSync(file, 'utf8'));
  assert.equal(typeof parsed, 'object');
  assert.ok(parsed);
  return parsed as Record<string, unknown>;
}

test('action.yml is a composite action with a threshold and a score output', () => {
  const action = readYaml('action.yml');
  assert.equal(typeof action.name, 'string');
  assert.match(String(action.description), /Unofficial|unofficial/);
  const runs = action.runs as { using?: string; steps?: unknown[] };
  assert.equal(runs.using, 'composite');
  assert.ok((runs.steps?.length ?? 0) >= 2);
  const inputs = action.inputs as Record<string, { default?: string }>;
  assert.equal(inputs.path?.default, '.');
  assert.equal(inputs.threshold?.default, '60');
  assert.equal(inputs.comment?.default, 'false');
  const outputs = action.outputs as Record<string, { value?: string }>;
  assert.match(outputs.score?.value ?? '', /steps\.score\.outputs\.score/);
});

test('action shell scripts pass bash -n', () => {
  for (const script of ['scripts/action-score.sh', 'scripts/pr-comment.sh']) {
    const result = spawnSync('bash', ['-n', path.join(repoRoot, script)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('CI and the sample score workflow parse', () => {
  const ci = readYaml('.github/workflows/ci.yml');
  assert.equal(typeof ci.jobs, 'object');
  const score = readYaml('.github/workflows/score.yml');
  assert.equal(typeof score.jobs, 'object');
  assert.match(JSON.stringify(score), /examples\/fixture-pack/);
});
