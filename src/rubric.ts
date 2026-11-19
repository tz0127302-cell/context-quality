/**
 * Documented scoring constants. The README rubric table mirrors these numbers.
 * Freshness compares documents to code inside the pack, never to the wall clock,
 * so a git checkout does not look stale just because it was cloned later.
 */
export const RUBRIC = {
  relevance: {
    byteWeight: 0.7,
    fileWeight: 0.3,
  },
  freshness: {
    lagScale: 60,
    floor: 40,
    extraStalePenalty: 8,
    extraStaleCap: 24,
    defaultStaleDays: 180,
    noDocsScore: 70,
    noCodeScore: 80,
    singleDocScore: 80,
    singleCodeScore: 70,
    singleOtherScore: 75,
    mtimeFallbackScore: 88,
    mtimeSlackDays: 2,
  },
  completeness: {
    missingReadme: 30,
    brokenRef: 8,
    brokenRefCap: 40,
    missingInterface: 20,
    brokenImport: 6,
    brokenImportCap: 24,
    emptyFile: 4,
    emptyFileCap: 12,
  },
  tokens: {
    charsPerToken: 4,
    repeatMinChars: 30,
    repeatMinFiles: 3,
    boilerplateExtraTokens: 20,
    budgetPenaltyMax: 0.5,
    budgetPenaltySlope: 0.25,
    defaultBudget: 80_000,
  },
  structure: {
    readme: 20,
    headings: 10,
    codeSample: 5,
    entrypoint: 20,
    api: 20,
    layout: 15,
    agent: 10,
    headingsNeeded: 2,
    singleBase: 25,
    singleHeading: 20,
    singleRichHeadings: 10,
    singleFence: 15,
    singleLength: 10,
    singleLengthChars: 400,
    singleInstruction: 15,
    singleExport: 15,
  },
  secrets: {
    patternPenalty: 25,
    dotenvPenalty: 10,
  },
} as const;

export const DIMENSION_LABELS = {
  relevance: 'Relevance',
  freshness: 'Freshness',
  completeness: 'Completeness',
  tokens: 'Token efficiency',
  structure: 'Structure',
  secrets: 'Secret risk',
} as const;

export const DEFAULT_WEIGHTS = {
  relevance: 0.2,
  freshness: 0.15,
  completeness: 0.2,
  tokens: 0.15,
  structure: 0.15,
  secrets: 0.15,
} as const;
