import type { ReportFormat, ScoreReport } from '../types.js';
export { renderAnnotations, renderGithub } from './github.js';
export { renderMarkdown, renderSuggestions } from './markdown.js';
export { renderSarif } from './sarif.js';
export { renderTerminal, scoreBar } from './terminal.js';
export declare function formatReport(report: ScoreReport, format: ReportFormat, color?: boolean): string;
//# sourceMappingURL=index.d.ts.map