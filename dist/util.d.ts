import type { Grade } from './types.js';
export declare function clamp(n: number, min: number, max: number): number;
export declare function roundScore(n: number): number;
export declare function gradeFor(score: number): Grade;
export declare function basename(p: string): string;
export declare function extname(p: string): string;
export declare function toPosix(p: string): string;
export declare function lineAt(content: string, index: number): number;
export declare function formatBytes(n: number): string;
export declare function formatPercent(weight: number): string;
export declare class CqsError extends Error {
    readonly exitCode: 2 | 3;
    constructor(message: string, exitCode: 2 | 3);
}
//# sourceMappingURL=util.d.ts.map