import type { ReportFormat, ScoreReport } from '../types.js';
import { renderGithub } from './github.js';
import { renderMarkdown } from './markdown.js';
import { renderSarif } from './sarif.js';
import { renderTerminal } from './terminal.js';

export { renderAnnotations, renderGithub } from './github.js';
export { renderMarkdown, renderSuggestions } from './markdown.js';
export { renderSarif } from './sarif.js';
export { renderTerminal, scoreBar } from './terminal.js';

export function formatReport(report: ScoreReport, format: ReportFormat, color = false): string {
  switch (format) {
    case 'json':
      return `${JSON.stringify(report, null, 2)}\n`;
    case 'markdown':
      return renderMarkdown(report);
    case 'sarif':
      return `${JSON.stringify(renderSarif(report), null, 2)}\n`;
    case 'github':
      return renderGithub(report);
    default:
      return renderTerminal(report, { color });
  }
}
