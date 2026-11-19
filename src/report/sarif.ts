import type { Finding, ScoreReport, Severity } from '../types.js';

const RULE_HELP: Record<string, string> = {
  'relevance/lockfile': 'Lockfiles are low-signal context for a coding agent.',
  'relevance/duplicate': 'Duplicate files repeat the same bytes without adding signal.',
  'relevance/minified': 'Minified or generated bundles should stay out of the pack.',
  'relevance/vendored': 'Vendored dependency trees drown the files under edit.',
  'relevance/binary': 'Binary files are not useful text context.',
  'relevance/oversized': 'Files over maxFileBytes are not read.',
  'freshness/stale-doc': 'A document is older than the code it describes, beyond staleDays.',
  'freshness/no-docs': 'The pack has code and no documentation to compare.',
  'freshness/no-code': 'The pack has docs and no source to compare.',
  'freshness/no-embedded-dates': 'Freshness could not use embedded dates.',
  'freshness/single-file': 'A single file has nothing to compare for freshness.',
  'completeness/missing-readme': 'A multi-file pack has no README.',
  'completeness/broken-ref': 'A relative link does not resolve in the pack.',
  'completeness/missing-interface': 'Implementations exist without an interface or API signal.',
  'completeness/broken-import': 'A relative import does not resolve in the pack.',
  'completeness/empty-file': 'A text file is empty.',
  'tokens/boilerplate': 'Long lines are repeated across files.',
  'tokens/over-budget': 'Estimated tokens exceed tokenBudget.',
  'structure/thin-readme': 'The README is missing or has too little structure.',
  'structure/no-example': 'The README has no fenced example.',
  'structure/no-entrypoint': 'No entrypoint file or package manifest entry was found.',
  'structure/no-api-docs': 'No API documentation signal was found.',
  'secrets/aws-access-key': 'A line matches an AWS access key id pattern. The value is never stored.',
  'secrets/github-pat': 'A line matches a GitHub personal access token pattern. The value is never stored.',
  'secrets/github-fine-grained': 'A line matches a GitHub fine-grained token pattern. The value is never stored.',
  'secrets/slack-token': 'A line matches a Slack token pattern. The value is never stored.',
  'secrets/google-api-key': 'A line matches a Google API key pattern. The value is never stored.',
  'secrets/openai-key': 'A line matches an OpenAI-style key pattern. The value is never stored.',
  'secrets/private-key': 'A line matches a private key header. The value is never stored.',
  'secrets/generic-assignment': 'A line assigns a credential-like value. The value is never stored.',
  'secrets/dotenv-file': 'An environment file is part of the pack.',
  'pack/unreadable': 'A file could not be read.',
};

function sarifLevel(severity: Severity): 'error' | 'warning' | 'note' {
  if (severity === 'error') return 'error';
  if (severity === 'warning') return 'warning';
  return 'note';
}

function resultFor(finding: Finding): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ruleId: finding.ruleId,
    level: sarifLevel(finding.severity),
    message: { text: finding.message },
  };
  if (finding.file) {
    result.locations = [{
      physicalLocation: {
        artifactLocation: { uri: finding.file },
        region: { startLine: finding.line && finding.line > 0 ? finding.line : 1 },
      },
    }];
  }
  return result;
}

export function renderSarif(report: ScoreReport): Record<string, unknown> {
  const ruleIds = new Set<string>(Object.keys(RULE_HELP));
  for (const finding of report.findings) ruleIds.add(finding.ruleId);
  const rules = [...ruleIds].sort().map((id) => ({
    id,
    shortDescription: { text: RULE_HELP[id] ?? id },
    help: { text: RULE_HELP[id] ?? 'Context quality finding. Secret values are never included.' },
    properties: { tags: ['context-quality'] },
  }));

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'cqs',
          fullName: 'context-quality',
          version: report.version,
          informationUri: 'https://github.com/tz0127302-cell/context-quality',
          rules,
        },
      },
      properties: {
        cqs: {
          overall: report.overall,
          grade: report.grade,
          passed: report.passed,
          threshold: report.threshold,
          tokensEstimated: report.tokensEstimated,
          filesScanned: report.filesScanned,
        },
      },
      results: report.findings.map(resultFor),
    }],
  };
}
