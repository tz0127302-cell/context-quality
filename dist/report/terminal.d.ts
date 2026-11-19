import type { ScoreReport } from '../types.js';
export interface TerminalOptions {
    color?: boolean;
    suggestionLimit?: number;
    findingLimit?: number;
}
export declare function scoreBar(score: number, width?: number): string;
export declare function renderTerminal(report: ScoreReport, options?: TerminalOptions): string;
//# sourceMappingURL=terminal.d.ts.map