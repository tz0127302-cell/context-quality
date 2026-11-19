import { RUBRIC } from './rubric.js';
/** Deterministic token estimate: about four characters per token. No model, no network. */
export function estimateTokens(text) {
    if (text.length === 0)
        return 0;
    return Math.max(1, Math.ceil(text.length / RUBRIC.tokens.charsPerToken));
}
//# sourceMappingURL=tokens.js.map