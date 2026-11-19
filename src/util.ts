import type { Grade } from './types.js';

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function roundScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return clamp(Math.round(n), 0, 100);
}

export function gradeFor(score: number): Grade {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
}

export function basename(p: string): string {
  const norm = p.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/');
  return i === -1 ? norm : norm.slice(i + 1);
}

export function extname(p: string): string {
  const base = basename(p);
  const i = base.lastIndexOf('.');
  if (i <= 0) return '';
  return base.slice(i).toLowerCase();
}

export function toPosix(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function lineAt(content: string, index: number): number {
  let line = 1;
  const end = Math.min(index, content.length);
  for (let i = 0; i < end; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatPercent(weight: number): string {
  const pct = weight * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export class CqsError extends Error {
  readonly exitCode: 2 | 3;

  constructor(message: string, exitCode: 2 | 3) {
    super(message);
    this.name = 'CqsError';
    this.exitCode = exitCode;
  }
}
