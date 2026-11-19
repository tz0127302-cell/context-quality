import type { Finding, ScoreReport } from '../types.js';

function escapeProperty(value: string): string {
  return value
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

function escapeMessage(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

export function renderAnnotations(report: ScoreReport): string {
  return report.findings.map((finding) => annotation(finding)).join('\n');
}

function annotation(finding: Finding): string {
  const level = finding.severity === 'error' ? 'error' : finding.severity === 'warning' ? 'warning' : 'notice';
  const props = [
    finding.file ? `file=${escapeProperty(finding.file)}` : '',
    finding.line ? `line=${finding.line}` : '',
    `title=${escapeProperty(`cqs ${finding.ruleId}`)}`,
  ].filter(Boolean);
  return `::${level} ${props.join(',')}::${escapeMessage(finding.message)}`;
}

export function renderGithub(report: ScoreReport): string {
  const body = [
    renderAnnotations(report),
    `CQS_SCORE=${report.overall}`,
    `CQS_GRADE=${report.grade}`,
    `CQS_PASSED=${report.passed ? 'true' : 'false'}`,
  ].filter((line) => line.length > 0);
  return `${body.join('\n')}\n`;
}
