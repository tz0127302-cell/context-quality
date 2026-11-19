export declare const DEFAULT_IGNORE: string[];
/** Convert a small glob subset (`*`, `?`, `**`) into a full-path regular expression. */
export declare function globToRegExp(raw: string): RegExp;
export declare function compileGlobs(patterns: string[]): RegExp[];
export declare function isIgnored(relPath: string, regexes: RegExp[], kind: 'file' | 'dir'): boolean;
//# sourceMappingURL=ignore.d.ts.map