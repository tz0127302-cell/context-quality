import { DEFAULT_IGNORE } from './ignore.js';
import { DEFAULT_WEIGHTS } from './rubric.js';
import { type CqsConfig, type DimensionId, type ResolvedConfig } from './types.js';
export { DEFAULT_IGNORE, DEFAULT_WEIGHTS };
export declare function defaultConfigDocument(): CqsConfig;
export declare function normalizeWeights(weights: Partial<Record<DimensionId, number>>): Record<DimensionId, number>;
export declare function resolveConfig(partial?: CqsConfig): ResolvedConfig;
export declare function effectiveIgnore(config: ResolvedConfig, extra?: string[]): string[];
export declare function findConfigFile(start: string): string | undefined;
export interface LoadConfigOptions {
    cwd?: string;
    configPath?: string;
    extraIgnore?: string[];
    noDefaultIgnores?: boolean;
    threshold?: number;
    failOnSecrets?: boolean;
    maxFileBytes?: number;
}
export declare function loadConfig(options?: LoadConfigOptions): ResolvedConfig;
export declare function writeDefaultConfig(dir: string, force?: boolean): string;
//# sourceMappingURL=config.d.ts.map