import assert from 'node:assert/strict';
import { test } from 'node:test';

import { globToRegExp, isIgnored } from '../src/ignore.js';

test('globs match files in any directory and do not over-match', () => {
  const png = globToRegExp('**/*.png');
  assert.equal(png.test('logo.png'), true);
  assert.equal(png.test('assets/logo.png'), true);
  assert.equal(png.test('assets/logo.png.txt'), false);

  const lock = globToRegExp('*.lock');
  assert.equal(lock.test('Cargo.lock'), true);
  assert.equal(lock.test('vendor/Cargo.lock'), true);
  assert.equal(lock.test('Cargo.lock.json'), false);

  const docs = globToRegExp('docs/*.md');
  assert.equal(docs.test('docs/guide.md'), true);
  assert.equal(docs.test('docs/nested/guide.md'), false);
  assert.equal(docs.test('src/docs/guide.md'), false);
});

test('directory ignore probes skip dependency folders before they are read', () => {
  const regexes = [globToRegExp('**/node_modules/**'), globToRegExp('**/.git/**')];
  assert.equal(isIgnored('node_modules', regexes, 'dir'), true);
  assert.equal(isIgnored('pkg/node_modules', regexes, 'dir'), true);
  assert.equal(isIgnored('node_modules/leftpad/index.js', regexes, 'file'), true);
  assert.equal(isIgnored('node_modules_backup/index.js', regexes, 'file'), false);
  assert.equal(isIgnored('src', regexes, 'dir'), false);
  assert.equal(isIgnored('.git', regexes, 'dir'), true);
});
