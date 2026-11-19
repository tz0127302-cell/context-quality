/**
 * Documented scoring constants. The README rubric table mirrors these numbers.
 * Freshness compares documents to code inside the pack, never to the wall clock,
 * so a git checkout does not look stale just because it was cloned later.
 */
export declare const RUBRIC: {
    readonly relevance: {
        readonly byteWeight: 0.7;
        readonly fileWeight: 0.3;
    };
    readonly freshness: {
        readonly lagScale: 60;
        readonly floor: 40;
        readonly extraStalePenalty: 8;
        readonly extraStaleCap: 24;
        readonly defaultStaleDays: 180;
        readonly noDocsScore: 70;
        readonly noCodeScore: 80;
        readonly singleDocScore: 80;
        readonly singleCodeScore: 70;
        readonly singleOtherScore: 75;
        readonly mtimeFallbackScore: 88;
        readonly mtimeSlackDays: 2;
    };
    readonly completeness: {
        readonly missingReadme: 30;
        readonly brokenRef: 8;
        readonly brokenRefCap: 40;
        readonly missingInterface: 20;
        readonly brokenImport: 6;
        readonly brokenImportCap: 24;
        readonly emptyFile: 4;
        readonly emptyFileCap: 12;
    };
    readonly tokens: {
        readonly charsPerToken: 4;
        readonly repeatMinChars: 30;
        readonly repeatMinFiles: 3;
        readonly boilerplateExtraTokens: 20;
        readonly budgetPenaltyMax: 0.5;
        readonly budgetPenaltySlope: 0.25;
        readonly defaultBudget: 80000;
    };
    readonly structure: {
        readonly readme: 20;
        readonly headings: 10;
        readonly codeSample: 5;
        readonly entrypoint: 20;
        readonly api: 20;
        readonly layout: 15;
        readonly agent: 10;
        readonly headingsNeeded: 2;
        readonly singleBase: 25;
        readonly singleHeading: 20;
        readonly singleRichHeadings: 10;
        readonly singleFence: 15;
        readonly singleLength: 10;
        readonly singleLengthChars: 400;
        readonly singleInstruction: 15;
        readonly singleExport: 15;
    };
    readonly secrets: {
        readonly patternPenalty: 25;
        readonly dotenvPenalty: 10;
    };
};
export declare const DIMENSION_LABELS: {
    readonly relevance: "Relevance";
    readonly freshness: "Freshness";
    readonly completeness: "Completeness";
    readonly tokens: "Token efficiency";
    readonly structure: "Structure";
    readonly secrets: "Secret risk";
};
export declare const DEFAULT_WEIGHTS: {
    readonly relevance: 0.2;
    readonly freshness: 0.15;
    readonly completeness: 0.2;
    readonly tokens: 0.15;
    readonly structure: 0.15;
    readonly secrets: 0.15;
};
//# sourceMappingURL=rubric.d.ts.map