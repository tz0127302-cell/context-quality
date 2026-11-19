import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveConfig } from '../src/config.js';
import { containsCredentialPattern } from '../src/credentials.js';
import { renderAnnotations, renderMarkdown, renderSarif } from '../src/report/index.js';
import { scoreContext } from '../src/score.js';
import { stringsOf } from './helpers.js';

const config = resolveConfig();
const token = `ghp_${'1234567890abcdefghij'}${'klmnopqrstuvwxyz'}`;
const aws = `AKIA${'IOSFODNN7EXAMPLE'}`;
const header = `-----BEGIN ${'PRIVATE KEY'}-----`;

test('credential patterns are detected and the matched text is never stored', async () => {
  assert.equal(token.length, 40);
  assert.equal(containsCredentialPattern(`prefix ${token} suffix`), true);
  assert.equal(containsCredentialPattern('API_KEY=your_api_key'), false);

  const report = await scoreContext({
    config,
    kind: 'pack',
    rootLabel: 'memory',
    files: [
      { path: 'README.md', content: '# Pack\n\nLast updated: 2026-11-01\n', mtimeMs: 1 },
      { path: '.env', content: `# local\nAPI_KEY=${token}\n`, mtimeMs: 1 },
      { path: 'notes.txt', content: `cloud ${aws}\n${header}\n`, mtimeMs: 1 },
      { path: '.env.example', content: 'API_KEY=your_api_key\nSERVICE_TOKEN=placeholder\n', mtimeMs: 1 },
      { path: 'src/config.ts', content: 'export const key = process.env.API_KEY;\n', mtimeMs: 1 },
    ],
  });

  const rules = report.findings.map((finding) => finding.ruleId);
  assert.ok(rules.includes('secrets/github-pat'));
  assert.ok(rules.includes('secrets/aws-access-key'));
  assert.ok(rules.includes('secrets/private-key'));
  assert.ok(rules.includes('secrets/dotenv-file'));
  assert.equal(rules.includes('secrets/generic-assignment'), false);
  const secrets = report.dimensions.find((dimension) => dimension.id === 'secrets');
  assert.equal(secrets?.score, 15);

  const blob = [
    JSON.stringify(report),
    renderMarkdown(report),
    JSON.stringify(renderSarif(report)),
    renderAnnotations(report),
  ].join('\n');
  assert.equal(blob.includes(token), false);
  assert.equal(blob.includes(aws), false);
  assert.equal(blob.includes(header), false);
  assert.equal(stringsOf(report).some((value) => value.includes(token)), false);
});

test('placeholder assignments and example env files are clean', async () => {
  const report = await scoreContext({
    config,
    kind: 'single',
    files: [{ path: '.env.example', content: 'API_KEY=your_api_key\nTOKEN=placeholder\n', mtimeMs: 1 }],
  });
  assert.equal(report.dimensions.find((dimension) => dimension.id === 'secrets')?.score, 100);
  assert.equal(report.findings.some((finding) => finding.dimension === 'secrets'), false);
});

test('ordinary source variables are not credential assignments', async () => {
  const report = await scoreContext({
    config,
    kind: 'pack',
    files: [
      { path: 'src/cli.ts', content: 'const token = argv[i];\nconst flag = eq === -1 ? token : token.slice(0, eq);\n', mtimeMs: 1 },
      { path: 'src/re.ts', content: 'const LINK_RE = /!?\\[[^\\]]*\\]\\(([^)]+)\\)/g;\n', mtimeMs: 1 },
      { path: 'README.md', content: '# Notes\n\nLast updated: 2026-11-01\n\nSee [missing](./missing.md).\n', mtimeMs: 1 },
    ],
  });
  assert.equal(report.findings.some((finding) => finding.dimension === 'secrets'), false);
  assert.equal(report.findings.filter((finding) => finding.ruleId === 'completeness/broken-ref').length, 1);
  assert.equal(report.findings.find((finding) => finding.ruleId === 'completeness/broken-ref')?.file, 'README.md');
});

test('a generic high-entropy assignment is flagged without echoing it', async () => {
  const value = 'supersecretvalue123';
  const report = await scoreContext({
    config,
    kind: 'single',
    files: [{ path: 'local.txt', content: `api_key=${value}\n`, mtimeMs: 1 }],
  });
  assert.ok(report.findings.some((finding) => finding.ruleId === 'secrets/generic-assignment'));
  assert.equal(JSON.stringify(report).includes(value), false);
});

test('SARIF is 2.1.0 and GitHub annotations locate the file', async () => {
  const report = await scoreContext({
    config,
    kind: 'single',
    files: [{ path: 'notes.txt', content: `api_key=${'supersecretvalue123'}\n`, mtimeMs: 1 }],
  });
  const sarif = renderSarif(report) as { version: string; runs: Array<{ results: unknown[]; tool: { driver: { name: string } } }> };
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0]?.tool.driver.name, 'cqs');
  assert.ok((sarif.runs[0]?.results.length ?? 0) > 0);
  const annotations = renderAnnotations(report);
  assert.match(annotations, /::error file=notes\.txt,line=1,/);
  assert.equal(annotations.includes('supersecretvalue123'), false);
});
