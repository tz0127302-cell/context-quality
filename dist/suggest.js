import { RUBRIC } from './rubric.js';
const POINTS = {
    'relevance/lockfile': 12,
    'relevance/duplicate': 10,
    'relevance/minified': 12,
    'relevance/vendored': 15,
    'relevance/binary': 8,
    'relevance/oversized': 10,
    'freshness/stale-doc': 8,
    'freshness/no-docs': 30,
    'freshness/no-code': 12,
    'freshness/no-embedded-dates': 8,
    'completeness/missing-readme': 30,
    'completeness/broken-ref': 8,
    'completeness/missing-interface': 20,
    'completeness/broken-import': 6,
    'completeness/empty-file': 4,
    'tokens/boilerplate': 8,
    'tokens/over-budget': 15,
    'structure/thin-readme': 15,
    'structure/no-example': 5,
    'structure/no-entrypoint': 20,
    'structure/no-api-docs': 20,
    'secrets/dotenv-file': RUBRIC.secrets.dotenvPenalty,
};
function loc(finding) {
    if (finding.file && finding.line)
        return `${finding.file}:${finding.line}`;
    return finding.file ?? 'the pack';
}
function num(finding, key) {
    const value = finding.data?.[key];
    return typeof value === 'number' ? value : undefined;
}
function str(finding, key) {
    const value = finding.data?.[key];
    return typeof value === 'string' ? value : undefined;
}
function describe(finding) {
    const points = finding.ruleId.startsWith('secrets/') && finding.ruleId !== 'secrets/dotenv-file'
        ? RUBRIC.secrets.patternPenalty
        : POINTS[finding.ruleId];
    if (!points)
        return undefined;
    const file = finding.file;
    const files = file ? [file] : [];
    switch (finding.ruleId) {
        case 'relevance/lockfile':
            return {
                ruleId: finding.ruleId,
                dimension: 'relevance',
                points,
                files,
                title: `Exclude ${file ?? 'the lockfile'} from the context pack`,
                detail: `${loc(finding)} pins dependency integrity. Delete it from the pack, or add its name to "ignore" in .cqs.json.`,
            };
        case 'relevance/duplicate': {
            const canonical = str(finding, 'canonical');
            return {
                ruleId: finding.ruleId,
                dimension: 'relevance',
                points,
                files: canonical ? [file ?? '', canonical].filter(Boolean) : files,
                title: canonical ? `Delete duplicate ${file ?? 'file'} and keep ${canonical}` : `Delete duplicate ${file ?? 'file'}`,
                detail: canonical
                    ? `${file ?? 'This file'} matches ${canonical} byte for byte. Keep a single copy so the agent does not read the same text twice.`
                    : 'Remove the extra copy so the agent does not read the same text twice.',
            };
        }
        case 'relevance/minified':
            return {
                ruleId: finding.ruleId,
                dimension: 'relevance',
                points,
                files,
                title: `Drop minified file ${file ?? ''}`.trim(),
                detail: 'Minified bundles are poor context. Point the pack at the source file instead.',
            };
        case 'relevance/vendored':
            return {
                ruleId: finding.ruleId,
                dimension: 'relevance',
                points,
                files,
                title: `Remove vendored path ${file ?? ''}`.trim(),
                detail: 'Vendored trees drown the files the agent is supposed to edit. Add a vendor ignore glob unless the task is inside that tree.',
            };
        case 'relevance/binary':
            return {
                ruleId: finding.ruleId,
                dimension: 'relevance',
                points,
                files,
                title: `Leave binary file ${file ?? 'out of the pack'}`,
                detail: 'Binary content cannot be used as text context. Remove it from the file list.',
            };
        case 'relevance/oversized':
            return {
                ruleId: finding.ruleId,
                dimension: 'relevance',
                points,
                files,
                title: `Trim or exclude oversized ${file ?? 'file'}`,
                detail: 'The file is larger than maxFileBytes, so cqs did not read it and an agent should not have to either. Link to the relevant section instead.',
            };
        case 'freshness/stale-doc': {
            const docDate = str(finding, 'docDate') ?? 'an older date';
            const codeDate = str(finding, 'codeDate') ?? 'the code';
            const lag = num(finding, 'lagDays');
            return {
                ruleId: finding.ruleId,
                dimension: 'freshness',
                points,
                files,
                title: `Refresh ${file ?? 'the stale doc'} or drop it from the pack`,
                detail: `${loc(finding)} is ${lag ?? 'many'} days behind the newest code (${docDate} vs ${codeDate}). Update the doc after checking it, or remove it so the agent does not follow old instructions.`,
            };
        }
        case 'freshness/no-docs':
            return {
                ruleId: finding.ruleId,
                dimension: 'freshness',
                points,
                files,
                title: 'Add a README with a Last updated date',
                detail: 'The pack has code and no docs, so freshness cannot be checked. Add README.md with a purpose and a line `Last updated: YYYY-MM-DD`.',
            };
        case 'freshness/no-code':
            return {
                ruleId: finding.ruleId,
                dimension: 'freshness',
                points,
                files,
                title: 'Include the source the docs describe',
                detail: 'Docs with no code beside them cannot be checked for drift. Add the implementation files the agent is expected to edit.',
            };
        case 'freshness/no-embedded-dates':
            return {
                ruleId: finding.ruleId,
                dimension: 'freshness',
                points,
                files,
                title: 'Stamp the README and the main source file with dates',
                detail: 'Add `Last updated: YYYY-MM-DD` to the README and `@modified YYYY-MM-DD` on the primary source file. cqs compares those dates inside the pack, so a fresh git checkout does not pretend the docs are current.',
            };
        case 'completeness/missing-readme':
            return {
                ruleId: finding.ruleId,
                dimension: 'completeness',
                points,
                files: ['README.md'],
                title: 'Add README.md at the root of the pack',
                detail: 'State the task, the entrypoint, and any constraints in README.md. A multi-file pack without that map makes an agent guess where to start.',
            };
        case 'completeness/broken-ref': {
            const target = str(finding, 'target');
            return {
                ruleId: finding.ruleId,
                dimension: 'completeness',
                points,
                files,
                title: `Fix the broken link in ${file ?? 'the doc'}`,
                detail: target
                    ? `${loc(finding)} points at \`${target}\`, which is not in this pack. Retarget the link or remove it.`
                    : `${loc(finding)} has a relative link that does not resolve. Retarget it or remove it.`,
            };
        }
        case 'completeness/missing-interface':
            return {
                ruleId: finding.ruleId,
                dimension: 'completeness',
                points,
                files,
                title: 'Add a types module or exported interfaces',
                detail: 'The pack has implementations but no types file, `export interface`, JSDoc on exports, or an API heading. Add one of those so the agent can see the contract.',
            };
        case 'completeness/broken-import': {
            const target = str(finding, 'target');
            return {
                ruleId: finding.ruleId,
                dimension: 'completeness',
                points,
                files,
                title: `Resolve the import in ${file ?? 'source'}`,
                detail: target
                    ? `${loc(finding)} imports \`${target}\`, which is not in the pack. Include the module or fix the path.`
                    : `${loc(finding)} has a relative import that does not resolve inside the pack.`,
            };
        }
        case 'completeness/empty-file':
            return {
                ruleId: finding.ruleId,
                dimension: 'completeness',
                points,
                files,
                title: `Remove empty file ${file ?? ''}`.trim(),
                detail: 'An empty file takes a slot in the pack and tells the agent nothing. Delete it or fill it in.',
            };
        case 'tokens/boilerplate': {
            const extra = num(finding, 'extraTokens');
            return {
                ruleId: finding.ruleId,
                dimension: 'tokens',
                points,
                files,
                title: 'Delete repeated banner lines',
                detail: `The same long lines show up across ${num(finding, 'files') ?? 'several'} files, about ${extra ?? 'dozens of'} extra tokens. Keep a single copy.`,
            };
        }
        case 'tokens/over-budget':
            return {
                ruleId: finding.ruleId,
                dimension: 'tokens',
                points,
                files,
                title: 'Cut the pack down under the token budget',
                detail: `The pack is about ${num(finding, 'tokens') ?? 'too many'} tokens against a budget of ${num(finding, 'budget') ?? 'the configured limit'}. Remove lockfiles, duplicates, and files the task does not touch.`,
            };
        case 'structure/thin-readme':
            return {
                ruleId: finding.ruleId,
                dimension: 'structure',
                points,
                files: files.length > 0 ? files : ['README.md'],
                title: 'Give the README a scannable outline',
                detail: 'Use at least two headings and a fenced command or snippet. Agents use that outline as the map of the pack.',
            };
        case 'structure/no-example':
            return {
                ruleId: finding.ruleId,
                dimension: 'structure',
                points,
                files,
                title: 'Add a fenced example to the README',
                detail: 'Include one command or short snippet in a code fence so the agent can see how the project is run.',
            };
        case 'structure/no-entrypoint':
            return {
                ruleId: finding.ruleId,
                dimension: 'structure',
                points,
                files,
                title: 'Name an entrypoint',
                detail: 'Add src/index.ts (or main.py / main.go) or set "main" in package.json so the agent knows where execution starts.',
            };
        case 'structure/no-api-docs':
            return {
                ruleId: finding.ruleId,
                dimension: 'structure',
                points,
                files,
                title: 'Document the public API',
                detail: 'Add an `## API` section, JSDoc on each export, or a types module. That is the contract the agent should preserve.',
            };
        case 'secrets/dotenv-file':
            return {
                ruleId: finding.ruleId,
                dimension: 'secrets',
                points,
                files,
                title: `Remove ${file ?? '.env'} from the context pack`,
                detail: 'Keep live environment files out of agent context. Commit a .env.example that lists the keys with placeholders such as your_api_key, and add the real file to ignore.',
            };
        default:
            if (finding.ruleId.startsWith('secrets/')) {
                return {
                    ruleId: finding.ruleId,
                    dimension: 'secrets',
                    points,
                    files,
                    title: `Remove the credential-like value in ${file ?? 'the pack'}`,
                    detail: `${loc(finding)} matches a credential pattern. Delete that line from the pack. Rotate the credential if it was ever real. Do not replace it with the same value in a prompt, comment, or markdown report.`,
                };
            }
            return undefined;
    }
}
export function buildSuggestions(dimensions, findings, kind) {
    const drafts = [];
    const seen = new Set();
    for (const finding of findings) {
        const key = `${finding.ruleId}:${finding.file ?? ''}:${finding.line ?? ''}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const draft = describe(finding);
        if (draft)
            drafts.push(draft);
    }
    const structure = dimensions.find((dimension) => dimension.id === 'structure');
    if (kind === 'pack' && structure && structure.details.agentGuide !== true && structure.score < 100) {
        drafts.push({
            ruleId: 'structure/add-agent-guide',
            dimension: 'structure',
            points: RUBRIC.structure.agent,
            files: ['AGENTS.md'],
            title: 'Add AGENTS.md for the swarm',
            detail: 'Write a short AGENTS.md with the task, the commands to run, and the paths an agent must not edit. cqs treats that file as an agent guide.',
        });
    }
    const byDimension = new Map();
    for (const draft of drafts) {
        const list = byDimension.get(draft.dimension);
        if (list)
            list.push(draft);
        else
            byDimension.set(draft.dimension, [draft]);
    }
    const ranked = [];
    for (const [dimension, list] of byDimension) {
        const result = dimensions.find((item) => item.id === dimension);
        if (!result)
            continue;
        const available = Math.max(0, 100 - result.score);
        const requested = list.reduce((sum, draft) => sum + draft.points, 0);
        const scale = requested <= 0 ? 0 : Math.min(1, available / requested);
        for (const draft of list) {
            const raw = draft.points * scale * result.weight;
            let gain = Math.round(raw);
            if (gain <= 0 && raw > 0 && available > 0)
                gain = 1;
            if (gain <= 0)
                continue;
            ranked.push({
                rank: 0,
                ruleId: draft.ruleId,
                dimension: draft.dimension,
                title: draft.title,
                detail: draft.detail,
                estimatedGain: gain,
                files: draft.files,
            });
        }
    }
    ranked.sort((a, b) => b.estimatedGain - a.estimatedGain
        || a.ruleId.localeCompare(b.ruleId)
        || (a.files[0] ?? '').localeCompare(b.files[0] ?? ''));
    return ranked.map((suggestion, index) => ({ ...suggestion, rank: index + 1 }));
}
//# sourceMappingURL=suggest.js.map