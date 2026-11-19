export declare const DIMENSION_IDS: readonly ["relevance", "freshness", "completeness", "tokens", "structure", "secrets"];
export type DimensionId = (typeof DIMENSION_IDS)[number];
export type Grade = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type Severity = 'error' | 'warning' | 'note';
export type PackKind = 'single' | 'pack';
export interface Finding {
    ruleId: string;
    dimension: DimensionId;
    severity: Severity;
    message: string;
    file?: string;
    line?: number;
    data?: Record<string, string | number>;
}
export interface Suggestion {
    rank: number;
    ruleId: string;
    dimension: DimensionId;
    title: string;
    detail: string;
    estimatedGain: number;
    files: string[];
}
export interface DimensionResult {
    id: DimensionId;
    label: string;
    score: number;
    weight: number;
    details: Record<string, string | number | boolean | null>;
    findings: Finding[];
}
export interface LlmReport {
    enabled: boolean;
    executed: boolean;
    notes: string[];
}
export interface ScoreReport {
    tool: 'cqs';
    version: string;
    overall: number;
    grade: Grade;
    passed: boolean;
    threshold: number;
    failOnSecrets: boolean;
    root: string;
    kind: PackKind;
    filesScanned: number;
    tokensEstimated: number;
    bytes: number;
    elapsedMs: number;
    dimensions: DimensionResult[];
    findings: Finding[];
    suggestions: Suggestion[];
    llm: LlmReport;
}
export interface LoadedFile {
    path: string;
    content: string;
    size: number;
    mtimeMs: number;
    binary: boolean;
    oversized: boolean;
    /** Set when the file could not be read. Empty content is not treated as an empty file. */
    unreadable?: boolean;
    tokens: number;
}
/** In-memory file used by tests and library callers that already have contents. */
export interface InputFile {
    path: string;
    content?: string;
    size?: number;
    mtimeMs?: number;
    binary?: boolean;
    oversized?: boolean;
}
export interface CqsConfig {
    version?: number;
    ignore?: string[];
    useDefaultIgnores?: boolean;
    weights?: Partial<Record<DimensionId, number>>;
    tokenBudget?: number;
    staleDays?: number;
    threshold?: number;
    maxFileBytes?: number;
    maxFiles?: number;
    failOnSecrets?: boolean;
    llm?: {
        enabled?: boolean;
        command?: string;
    };
}
export interface ResolvedConfig {
    ignore: string[];
    useDefaultIgnores: boolean;
    weights: Record<DimensionId, number>;
    tokenBudget: number;
    staleDays: number;
    threshold: number;
    maxFileBytes: number;
    maxFiles: number;
    failOnSecrets: boolean;
    llm: {
        enabled: boolean;
        command?: string;
    };
}
export interface LlmReviewInput {
    files: Array<{
        path: string;
        tokens: number;
    }>;
    report: ScoreReport;
}
export type LlmReviewer = (input: LlmReviewInput) => Promise<string[] | void> | string[] | void;
export type ReportFormat = 'pretty' | 'json' | 'markdown' | 'sarif' | 'github';
export interface DimensionDraft {
    id: DimensionId;
    score: number;
    findings: Finding[];
    details: Record<string, string | number | boolean | null>;
}
//# sourceMappingURL=types.d.ts.map