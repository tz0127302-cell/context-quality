import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { scoreContext } from '../src/score.js';
import { repoRoot } from './helpers.js';

test('the fixture pack stays inside its pinned score and keeps its known defects', async () => {
  const fixture = path.join(repoRoot, 'examples/fixture-pack');
  const rawEnv = readFileSync(path.join(fixture, '.env'), 'utf8');
  const token = /ghp_[A-Za-z0-9]{36}/.exec(rawEnv)?.[0];
  assert.ok(token, 'fixture should contain a synthetic token pattern');

  const report = await scoreContext({ cwd: repoRoot, paths: [fixture] });
  const scores = Object.fromEntries(report.dimensions.map((dimension) => [dimension.id, dimension.score]));
  const rules = report.findings.map((finding) => finding.ruleId).sort();
  const pinned = JSON.parse(readFileSync(path.join(repoRoot, 'examples/fixture-pack.expected.json'), 'utf8')) as {
    overall: number;
    grade: string;
    filesScanned: number;
    dimensions: Record<string, number>;
  };
  assert.equal(report.overall, pinned.overall);
  assert.equal(report.grade, pinned.grade);
  assert.equal(report.filesScanned, pinned.filesScanned);
  assert.deepEqual(scores, pinned.dimensions);

  for (const rule of [
    'relevance/lockfile',
    'relevance/duplicate',
    'freshness/stale-doc',
    'completeness/broken-ref',
    'secrets/github-pat',
    'secrets/dotenv-file',
    'tokens/boilerplate',
  ]) {
    assert.ok(rules.includes(rule), `missing ${rule} in ${rules.join(', ')}`);
  }

  const duplicate = report.findings.find((finding) => finding.ruleId === 'relevance/duplicate');
  assert.equal(duplicate?.file, 'notes/duplicate.ts');
  assert.equal(duplicate?.data?.canonical, 'src/util.ts');
  assert.equal(JSON.stringify(report).includes(token), false);
  assert.ok(report.suggestions[0]);
  assert.ok((report.suggestions[0]?.estimatedGain ?? 0) >= (report.suggestions.at(-1)?.estimatedGain ?? 0));
  assert.equal(report.llm.enabled, false);
  assert.equal(report.llm.executed, false);
});
