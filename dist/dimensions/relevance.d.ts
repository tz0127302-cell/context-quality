import type { DimensionDraft, LoadedFile } from '../types.js';
/** Map of duplicate path to the canonical path that should be kept. */
export declare function duplicateMap(files: LoadedFile[]): Map<string, string>;
export declare function scoreRelevance(files: LoadedFile[]): DimensionDraft & {
    noisePaths: Set<string>;
};
//# sourceMappingURL=relevance.d.ts.map