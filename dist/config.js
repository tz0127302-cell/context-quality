import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DEFAULT_IGNORE } from './ignore.js';
import { DEFAULT_WEIGHTS, RUBRIC } from './rubric.js';
import { DIMENSION_IDS } from './types.js';
import { CqsError } from './util.js';
export { DEFAULT_IGNORE, DEFAULT_WEIGHTS };
const CONFIG_NAMES = ['.cqs.json', 'cqs.config.json'];
export function defaultConfigDocument() {
    return {
        version: 1,
        ignore: [],
        useDefaultIgnores: true,
        weights: { ...DEFAULT_WEIGHTS },
        tokenBudget: RUBRIC.tokens.defaultBudget,
        staleDays: RUBRIC.freshness.defaultStaleDays,
        threshold: 0,
        maxFileBytes: 512_000,
        maxFiles: 20_000,
        failOnSecrets: false,
        llm: { enabled: false },
    };
}
export function normalizeWeights(weights) {
    let sum = 0;
    const clean = {};
    for (const id of DIMENSION_IDS) {
        const value = weights[id] ?? 0;
        if (!Number.isFinite(value) || value < 0) {
            throw new CqsError(`Weight "${id}" must be a non-negative number.`, 3);
        }
        clean[id] = value;
        sum += value;
    }
    if (sum === 0) {
        const even = 1 / DIMENSION_IDS.length;
        for (const id of DIMENSION_IDS)
            clean[id] = even;
        return clean;
    }
    for (const id of DIMENSION_IDS)
        clean[id] = clean[id] / sum;
    return clean;
}
export function resolveConfig(partial = {}) {
    const weights = normalizeWeights({ ...DEFAULT_WEIGHTS, ...partial.weights });
    const threshold = partial.threshold ?? 0;
    const staleDays = partial.staleDays ?? RUBRIC.freshness.defaultStaleDays;
    const tokenBudget = partial.tokenBudget ?? RUBRIC.tokens.defaultBudget;
    const maxFileBytes = partial.maxFileBytes ?? 512_000;
    const maxFiles = partial.maxFiles ?? 20_000;
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
        throw new CqsError('threshold must be an integer from 0 to 100.', 3);
    }
    if (!Number.isFinite(staleDays) || staleDays <= 0) {
        throw new CqsError('staleDays must be a positive number.', 3);
    }
    if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
        throw new CqsError('tokenBudget must be a positive number.', 3);
    }
    if (!Number.isFinite(maxFileBytes) || maxFileBytes < 1) {
        throw new CqsError('maxFileBytes must be a positive number.', 3);
    }
    if (!Number.isInteger(maxFiles) || maxFiles < 1) {
        throw new CqsError('maxFiles must be a positive integer.', 3);
    }
    if (partial.llm && partial.llm.enabled !== undefined && typeof partial.llm.enabled !== 'boolean') {
        throw new CqsError('llm.enabled must be a boolean.', 3);
    }
    const ignore = partial.ignore ?? [];
    if (!Array.isArray(ignore) || ignore.some((g) => typeof g !== 'string' || g.trim() === '')) {
        throw new CqsError('ignore must be an array of glob strings.', 3);
    }
    return {
        ignore,
        useDefaultIgnores: partial.useDefaultIgnores ?? true,
        weights,
        tokenBudget,
        staleDays,
        threshold,
        maxFileBytes,
        maxFiles,
        failOnSecrets: partial.failOnSecrets ?? false,
        llm: {
            enabled: partial.llm?.enabled ?? false,
            ...(partial.llm?.command ? { command: partial.llm.command } : {}),
        },
    };
}
export function effectiveIgnore(config, extra = []) {
    const base = config.useDefaultIgnores ? DEFAULT_IGNORE : [];
    return [...base, ...config.ignore, ...extra];
}
function parseConfigFile(file) {
    let text;
    try {
        text = readFileSync(file, 'utf8');
    }
    catch {
        throw new CqsError(`Cannot read config file: ${file}`, 3);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new CqsError(`Config file is not valid JSON: ${file}`, 3);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new CqsError(`Config file must be a JSON object: ${file}`, 3);
    }
    return parsed;
}
export function findConfigFile(start) {
    let dir = resolve(start);
    for (;;) {
        for (const name of CONFIG_NAMES) {
            const candidate = join(dir, name);
            if (existsSync(candidate) && statSync(candidate).isFile())
                return candidate;
        }
        if (existsSync(join(dir, '.git')))
            break;
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return undefined;
}
export function loadConfig(options = {}) {
    const cwd = options.cwd ?? process.cwd();
    let partial = {};
    if (options.configPath) {
        const file = resolve(cwd, options.configPath);
        if (!existsSync(file))
            throw new CqsError(`Config file not found: ${file}`, 3);
        partial = parseConfigFile(file);
    }
    else {
        const found = findConfigFile(cwd);
        if (found)
            partial = parseConfigFile(found);
    }
    if (options.noDefaultIgnores)
        partial.useDefaultIgnores = false;
    if (options.threshold !== undefined)
        partial.threshold = options.threshold;
    if (options.failOnSecrets !== undefined)
        partial.failOnSecrets = options.failOnSecrets;
    if (options.maxFileBytes !== undefined)
        partial.maxFileBytes = options.maxFileBytes;
    if (options.extraIgnore && options.extraIgnore.length > 0) {
        partial.ignore = [...(partial.ignore ?? []), ...options.extraIgnore];
    }
    return resolveConfig(partial);
}
export function writeDefaultConfig(dir, force = false) {
    const target = join(resolve(dir), '.cqs.json');
    if (existsSync(target) && !force) {
        throw new CqsError(`Refusing to overwrite ${target}. Pass --force to replace it.`, 3);
    }
    const body = `${JSON.stringify(defaultConfigDocument(), null, 2)}\n`;
    writeFileSync(target, body, 'utf8');
    return target;
}
//# sourceMappingURL=config.js.map