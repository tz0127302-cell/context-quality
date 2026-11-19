import { RUBRIC } from '../rubric.js';
import { roundScore } from '../util.js';
export function repetitionStats(files) {
    const perLine = new Map();
    for (const file of files) {
        if (file.binary || file.oversized || file.unreadable || file.path === '<stdin>')
            continue;
        const seen = new Set();
        for (const line of file.content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed.length < RUBRIC.tokens.repeatMinChars || seen.has(trimmed))
                continue;
            seen.add(trimmed);
            const owners = perLine.get(trimmed);
            if (owners)
                owners.add(file.path);
            else
                perLine.set(trimmed, new Set([file.path]));
        }
    }
    let extraChars = 0;
    let repeatedLines = 0;
    const involved = new Set();
    for (const [line, owners] of perLine) {
        if (owners.size < RUBRIC.tokens.repeatMinFiles)
            continue;
        repeatedLines += 1;
        extraChars += line.length * (owners.size - 1);
        for (const owner of owners)
            involved.add(owner);
    }
    return {
        extraChars,
        extraTokens: extraChars === 0 ? 0 : Math.max(1, Math.ceil(extraChars / RUBRIC.tokens.charsPerToken)),
        repeatedLines,
        filesInvolved: [...involved].sort(),
    };
}
export function scoreTokens(files, config) {
    const textChars = files.reduce((sum, file) => {
        if (file.binary || file.oversized || file.unreadable)
            return sum;
        return sum + file.content.length;
    }, 0);
    const stats = repetitionStats(files);
    const redundancy = textChars === 0 ? 0 : Math.min(1, stats.extraChars / textChars);
    let score = roundScore(100 * (1 - redundancy));
    const tokens = files.reduce((sum, file) => sum + file.tokens, 0);
    const findings = [];
    if (stats.extraTokens >= RUBRIC.tokens.boilerplateExtraTokens) {
        const shown = stats.filesInvolved.slice(0, 8);
        findings.push({
            ruleId: 'tokens/boilerplate',
            dimension: 'tokens',
            severity: 'warning',
            message: `Repeated lines appear in ${shown.join(', ')} and add about ${stats.extraTokens} tokens of boilerplate.`,
            ...(shown[0] ? { file: shown[0] } : {}),
            data: { extraTokens: stats.extraTokens, files: stats.filesInvolved.length, lines: stats.repeatedLines },
        });
    }
    if (tokens > config.tokenBudget) {
        const overflow = (tokens - config.tokenBudget) / config.tokenBudget;
        const factor = 1 - Math.min(RUBRIC.tokens.budgetPenaltyMax, RUBRIC.tokens.budgetPenaltySlope * overflow);
        score = roundScore(score * factor);
        findings.push({
            ruleId: 'tokens/over-budget',
            dimension: 'tokens',
            severity: 'warning',
            message: `Estimated ${tokens} tokens exceeds the budget of ${config.tokenBudget}. Trim low-signal files before handing the pack to an agent.`,
            data: { tokens, budget: config.tokenBudget },
        });
    }
    return {
        id: 'tokens',
        score,
        findings,
        details: {
            estimatedTokens: tokens,
            redundancy: Math.round(redundancy * 1000) / 1000,
            extraTokens: stats.extraTokens,
            budget: config.tokenBudget,
        },
    };
}
//# sourceMappingURL=tokenEfficiency.js.map