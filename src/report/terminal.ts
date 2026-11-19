import type { ScoreReport } from '../types.js';
import { formatBytes, formatPercent } from '../util.js';

export interface TerminalOptions {
  color?: boolean;
  suggestionLimit?: number;
  findingLimit?: number;
}

function paint(enabled: boolean) {
  const wrap = (code: string) => (text: string) => (enabled ? `\u001b[${code}m${text}\u001b[0m` : text);
  return {
    bold: wrap('1'),
    dim: wrap('2'),
    red: wrap('31'),
    green: wrap('32'),
    yellow: wrap('33'),
    cyan: wrap('36'),
  };
}

export function scoreBar(score: number, width = 20): string {
  const filled = Math.max(0, Math.min(width, Math.round((score / 100) * width)));
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

function tone(score: number, c: ReturnType<typeof paint>, text: string): string {
  if (score >= 75) return c.green(text);
  if (score >= 60) return c.yellow(text);
  return c.red(text);
}

export function renderTerminal(report: ScoreReport, options: TerminalOptions = {}): string {
  const c = paint(options.color === true);
  const findingLimit = options.findingLimit ?? 12;
  const suggestionLimit = options.suggestionLimit ?? 5;
  const lines: string[] = [];

  lines.push(`${c.bold('cqs')} ${c.dim(report.version)}  context quality`);
  lines.push('');
  const headline = `${report.overall} / 100  ${report.grade}`;
  lines.push(`${c.bold('Overall')}  ${tone(report.overall, c, c.bold(headline))}`);
  lines.push(tone(report.overall, c, scoreBar(report.overall)));
  lines.push(c.dim(`${report.root}  ·  ${report.kind}`));
  lines.push(
    c.dim(
      `${report.filesScanned} files  ·  ${report.tokensEstimated.toLocaleString('en-US')} tokens  ·  ${formatBytes(report.bytes)}  ·  ${report.elapsedMs} ms`,
    ),
  );
  lines.push('');
  lines.push(`${c.dim('Dimension'.padEnd(18))} ${c.dim('Score'.padStart(5))}  ${c.dim('Weight'.padStart(6))}`);
  for (const dimension of report.dimensions) {
    const label = dimension.label.padEnd(18);
    const score = String(dimension.score).padStart(5);
    const weight = formatPercent(dimension.weight).padStart(6);
    lines.push(`${label} ${tone(dimension.score, c, score)}  ${weight}  ${tone(dimension.score, c, scoreBar(dimension.score, 10))}`);
  }

  lines.push('');
  lines.push(c.bold('Findings'));
  if (report.findings.length === 0) {
    lines.push(c.dim('  None. The heuristic checks are clean.'));
  } else {
    for (const finding of report.findings.slice(0, findingLimit)) {
      const severity = finding.severity === 'error'
        ? c.red('error  ')
        : finding.severity === 'warning'
          ? c.yellow('warning')
          : c.dim('note   ');
      const where = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ''}` : '';
      lines.push(`  ${severity}  ${c.cyan(finding.dimension.padEnd(13))}  ${where}`);
      lines.push(`           ${finding.message}`);
    }
    if (report.findings.length > findingLimit) {
      lines.push(c.dim(`  … ${report.findings.length - findingLimit} more`));
    }
  }

  lines.push('');
  lines.push(c.bold('Suggestions'));
  const suggestions = report.suggestions.slice(0, suggestionLimit);
  if (suggestions.length === 0) {
    lines.push(c.dim('  None. Nothing obvious to cut or add.'));
  } else {
    for (const suggestion of suggestions) {
      lines.push(`  ${c.bold(`${suggestion.rank}. +${suggestion.estimatedGain}`)}  ${suggestion.title}`);
      lines.push(`     ${c.dim(suggestion.detail)}`);
    }
    if (report.suggestions.length > suggestionLimit) {
      lines.push(c.dim(`  … ${report.suggestions.length - suggestionLimit} more via \`cqs suggest\``));
    }
  }

  lines.push('');
  const gate = report.passed ? c.green('pass') : c.red('fail');
  lines.push(`Threshold ${report.threshold}  ·  ${gate}`);
  if (report.llm.enabled) {
    lines.push(c.dim(`LLM hook ${report.llm.executed ? 'ran' : 'did not run'}. Score is still the heuristic result.`));
  }
  lines.push('');
  return lines.join('\n');
}
