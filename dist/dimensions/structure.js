import { isAgentGuide, isCodePath, isEntrypointBasename, isManifest, isReadme, } from '../classify.js';
import { RUBRIC } from '../rubric.js';
import { basename } from '../util.js';
function countHeadings(content) {
    return content.split(/\r?\n/).filter((line) => /^#{1,6}\s+\S/.test(line)).length;
}
function hasEntrypoint(files) {
    for (const file of files) {
        if (file.binary || file.oversized || file.unreadable)
            continue;
        if (isEntrypointBasename(file.path))
            return true;
        if (file.path.endsWith('.go') && /func\s+main\s*\(/.test(file.content))
            return true;
        if (basename(file.path).toLowerCase() === 'pyproject.toml' && /\[project\.scripts\]/.test(file.content)) {
            return true;
        }
        if (basename(file.path).toLowerCase() !== 'package.json')
            continue;
        try {
            const pkg = JSON.parse(file.content);
            if (typeof pkg.main === 'string' || typeof pkg.module === 'string' || pkg.bin || pkg.exports)
                return true;
        }
        catch {
            // Invalid JSON cannot prove an entrypoint.
        }
    }
    return false;
}
function hasApiSignal(files) {
    for (const file of files) {
        if (file.binary || file.oversized || file.unreadable)
            continue;
        if (file.path.endsWith('.d.ts') || /(?:^|\/)types\.[a-z0-9]+$/i.test(file.path))
            return true;
        if (/export\s+(interface|type)\s+/.test(file.content))
            return true;
        if (/^#{1,6}\s+.*\bAPI\b/im.test(file.content))
            return true;
        if (/\/\*\*[\s\S]{0,500}?\*\/\s*export\s+(async\s+)?(function|class|const)\b/.test(file.content)) {
            return true;
        }
    }
    return false;
}
function hasCode(files) {
    return files.some((file) => isCodePath(file.path) && !file.binary);
}
export function scoreStructure(files, kind) {
    if (kind === 'single')
        return scoreSingle(files[0]);
    const findings = [];
    let points = 0;
    const readme = files.find((file) => isReadme(file.path) && !file.binary);
    const entry = hasEntrypoint(files);
    const api = hasApiSignal(files);
    const agent = files.some((file) => isAgentGuide(file.path));
    const layout = files.some((file) => isManifest(file.path) || file.path.startsWith('src/'));
    let headings = 0;
    if (readme) {
        points += RUBRIC.structure.readme;
        headings = countHeadings(readme.content);
        if (headings >= RUBRIC.structure.headingsNeeded)
            points += RUBRIC.structure.headings;
        else {
            findings.push({
                ruleId: 'structure/thin-readme',
                dimension: 'structure',
                severity: 'note',
                file: readme.path,
                message: `README has ${headings} heading(s). Use at least ${RUBRIC.structure.headingsNeeded} so an agent can scan the pack.`,
            });
        }
        if (readme.content.includes('```'))
            points += RUBRIC.structure.codeSample;
        else {
            findings.push({
                ruleId: 'structure/no-example',
                dimension: 'structure',
                severity: 'note',
                file: readme.path,
                message: 'README has no fenced code sample. Add one command or snippet that shows how to start.',
            });
        }
    }
    else {
        findings.push({
            ruleId: 'structure/thin-readme',
            dimension: 'structure',
            severity: 'warning',
            message: 'No README. Add one with a purpose, at least two headings, and a fenced example.',
        });
    }
    if (entry)
        points += RUBRIC.structure.entrypoint;
    else if (hasCode(files)) {
        findings.push({
            ruleId: 'structure/no-entrypoint',
            dimension: 'structure',
            severity: 'warning',
            message: 'No entrypoint found. Add an index or main module, or set package.json "main".',
        });
    }
    if (api)
        points += RUBRIC.structure.api;
    else if (hasCode(files)) {
        findings.push({
            ruleId: 'structure/no-api-docs',
            dimension: 'structure',
            severity: 'warning',
            message: 'No API signal. Add an ## API section, JSDoc on exports, or a types module.',
        });
    }
    if (layout)
        points += RUBRIC.structure.layout;
    if (agent)
        points += RUBRIC.structure.agent;
    return {
        id: 'structure',
        score: Math.min(100, points),
        findings,
        details: {
            readme: readme?.path ?? '',
            headings,
            entrypoint: entry,
            api,
            layout,
            agentGuide: agent,
        },
    };
}
function scoreSingle(file) {
    if (!file) {
        return { id: 'structure', score: 0, findings: [], details: { mode: 'single' } };
    }
    let points = RUBRIC.structure.singleBase;
    const headings = countHeadings(file.content);
    if (headings >= 1)
        points += RUBRIC.structure.singleHeading;
    if (headings >= 3)
        points += RUBRIC.structure.singleRichHeadings;
    if (file.content.includes('```'))
        points += RUBRIC.structure.singleFence;
    if (file.content.length >= RUBRIC.structure.singleLengthChars)
        points += RUBRIC.structure.singleLength;
    if (/\b(goal|task|constraint|instruction|context|you are)\b/i.test(file.content)) {
        points += RUBRIC.structure.singleInstruction;
    }
    if (isCodePath(file.path) && /export\s+(async\s+)?(function|class|interface|type|const)\b/.test(file.content)) {
        points += RUBRIC.structure.singleExport;
    }
    const findings = [];
    if (headings === 0) {
        findings.push({
            ruleId: 'structure/thin-readme',
            dimension: 'structure',
            severity: 'note',
            file: file.path,
            message: 'Add headings so this prompt has a scannable outline.',
        });
    }
    return {
        id: 'structure',
        score: Math.min(100, points),
        findings,
        details: { mode: 'single', headings },
    };
}
//# sourceMappingURL=structure.js.map