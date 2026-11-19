import { type LoadConfigOptions } from './config.js';
import type { InputFile, LlmReviewer, LoadedFile, PackKind, ResolvedConfig, ScoreReport } from './types.js';
export interface ScoreOptions extends LoadConfigOptions {
    paths?: string[];
    listFile?: string;
    stdin?: string;
    files?: InputFile[];
    kind?: PackKind;
    rootLabel?: string;
    config?: ResolvedConfig;
    llmReviewer?: LlmReviewer;
}
export declare function normalizeInput(input: InputFile): LoadedFile;
export declare function scoreContext(options?: ScoreOptions): Promise<ScoreReport>;
//# sourceMappingURL=score.d.ts.map