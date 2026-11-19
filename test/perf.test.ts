import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { scoreContext } from '../src/score.js';

test('a thousand small files score in a few seconds', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cqs-perf-'));
  for (let i = 0; i < 1000; i += 1) {
    const name = `file-${String(i).padStart(4, '0')}.ts`;
    writeFileSync(path.join(dir, name), `export function f${i}() {\n  return ${i};\n}\n`);
  }
  const started = performance.now();
  const report = await scoreContext({ cwd: dir, paths: [dir] });
  const elapsed = performance.now() - started;
  assert.equal(report.filesScanned, 1000);
  assert.ok(elapsed < 5000, `scoring took ${elapsed.toFixed(0)} ms`);
});
