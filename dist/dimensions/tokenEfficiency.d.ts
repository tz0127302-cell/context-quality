import type { DimensionDraft, LoadedFile, ResolvedConfig } from '../types.js';
export interface Repetition {
    extraChars: number;
    extraTokens: number;
    repeatedLines: number;
    filesInvolved: string[];
}
export declare function repetitionStats(files: LoadedFile[]): Repetition;
export declare function scoreTokens(files: LoadedFile[], config: ResolvedConfig): DimensionDraft;
//# sourceMappingURL=tokenEfficiency.d.ts.map