export interface FoundDate {
    iso: string;
    utcMs: number;
}
/** Latest embedded calendar date in a file, if any. */
export declare function latestEmbeddedDate(content: string): FoundDate | undefined;
export declare function daysBetween(earlierMs: number, laterMs: number): number;
export declare function median(values: number[]): number;
//# sourceMappingURL=dates.d.ts.map