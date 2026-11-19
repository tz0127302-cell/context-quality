import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { readFileSync as readRoot } from 'node:fs';

import { repoRoot, runCli } from './helpers.js';

test('help and version are useful and exit 0', () => {
  const help = runCli(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  assert.match(help.stdout, /cqs suggest/);
  assert.match(help.stdout, /cqs init/);
  assert.match(help.stdout, /Exit codes:/);
  assert.match(help.stdout, /--json/);
  assert.match(help.stdout, /--threshold/);

  const version = runCli(['--version']);
  const pkg = JSON.parse(readRoot(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string };
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), pkg.version);
});

test('unknown flags exit 2', () => {
  const result = runCli(['score', '--not-a-real-flag']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown option/);
});

test('json, markdown, sarif, and github formats score the fixture', () => {
  const json = runCli(['score', 'examples/fixture-pack', '--json', '--threshold', '0']);
  assert.equal(json.status, 0, json.stderr);
  const report = JSON.parse(json.stdout) as { overall: number; tool: string; dimensions: unknown[] };
  assert.equal(report.tool, 'cqs');
  assert.equal(report.dimensions.length, 6);
  assert.equal(json.stdout.includes('ghp_'), false);

  const below = runCli(['score', 'examples/fixture-pack', '--threshold', '100', '--quiet']);
  assert.equal(below.status, 1);
  assert.match(below.stdout, /^\d+\n$/);

  const secrets = runCli(['score', 'examples/fixture-pack', '--fail-on-secrets', '--threshold', '0', '--quiet']);
  assert.equal(secrets.status, 1);

  const sarif = runCli(['score', 'examples/fixture-pack', '--format', 'sarif']);
  const doc = JSON.parse(sarif.stdout) as { version: string };
  assert.equal(doc.version, '2.1.0');
  assert.equal(sarif.stdout.includes('ghp_'), false);

  const github = runCli(['score', 'examples/fixture-pack', '--format', 'github']);
  assert.match(github.stdout, /::error file=\.env,line=2,/);
  assert.match(github.stdout, /CQS_SCORE=\d+/);
  assert.equal(github.stdout.includes('ghp_'), false);
});

test('suggest ranks concrete edits and stdin scores a prompt', () => {
  const suggest = runCli(['suggest', 'examples/fixture-pack', '--limit', '8']);
  assert.equal(suggest.status, 0, suggest.stderr);
  assert.match(suggest.stdout, /Ranked edits:/);
  assert.match(suggest.stdout, /\.env/);
  assert.match(suggest.stdout, /package-lock\.json/);
  assert.equal(suggest.stdout.includes('ghp_'), false);

  const stdin = runCli(['score', '--stdin', '--json'], {
    input: '# Task\n\n## Goal\n\nTighten retry backoff.\n\n## Context\n\nKeep the signature.\n',
  });
  assert.equal(stdin.status, 0, stdin.stderr);
  const report = JSON.parse(stdin.stdout) as { kind: string; filesScanned: number; overall: number };
  assert.equal(report.kind, 'single');
  assert.equal(report.filesScanned, 1);
  assert.ok(report.overall > 0);
});

test('init writes a config and refuses to overwrite it', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cqs-init-'));
  const created = runCli(['init', dir]);
  assert.equal(created.status, 0, created.stderr);
  const file = path.join(dir, '.cqs.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { llm: { enabled: boolean }; weights: { relevance: number } };
  assert.equal(parsed.llm.enabled, false);
  assert.equal(parsed.weights.relevance, 0.2);
  const again = runCli(['init', dir]);
  assert.equal(again.status, 3);
  assert.match(again.stderr, /Refusing to overwrite/);
  const forced = runCli(['init', dir, '--force']);
  assert.equal(forced.status, 0, forced.stderr);
});

test('--list scores an explicit file list', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cqs-list-'));
  const source = path.join(dir, 'main.ts');
  writeFileSync(source, 'export function main(){ return 1 }\n');
  const list = path.join(dir, 'files.txt');
  writeFileSync(list, `# comment\n${source}\n`);
  const result = runCli(['score', '--list', list, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout) as { filesScanned: number };
  assert.equal(report.filesScanned, 1);
});
