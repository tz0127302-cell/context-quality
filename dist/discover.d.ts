import type { LoadedFile, ResolvedConfig } from './types.js';
export interface DiscoverResult {
    files: LoadedFile[];
    root: string;
    /** Absolute directory used to resolve relative links. */
    rootAbs: string;
    kind: 'single' | 'pack';
}
export interface DiscoverOptions {
    cwd: string;
    paths: string[];
    listFile?: string;
    config: ResolvedConfig;
    extraIgnore?: string[];
}
export declare function discover(options: DiscoverOptions): DiscoverResult;
//# sourceMappingURL=discover.d.ts.map