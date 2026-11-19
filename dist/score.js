import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { containsCredentialPattern } from './credentials.js';
import { discover } from './discover.js';
import { scoreCompleteness } from './dimensions/completeness.js';
import { scoreFreshness } from './dimensions/freshness.js';
import { scoreRelevance } from './dimensions/relevance.js';
import { scoreSecrets } from './dimensions/secrets.js';
import { scoreStructure } from './dimensions/structure.js';
import { scoreTokens } from './dimensions/tokenEfficiency.js';
import { DIMENSION_LABELS } from './rubric.js';
import { buildSuggestions } from './suggest.js';
import { estimateTokens } from './tokens.js';
import { DIMENSION_IDS } from './types.js';
import { CqsError, gradeFor, roundScore, toPosix } from './util.js';
import { VERSION } from './version.js';
const SEVERITY_RANK = { error: 0, warning: 1, note: 2 };
export function normalizeInput(input) {
    const content = input.content ?? '';
    const binary = input.binary ?? false;
    const oversized = input.oversized ?? false;
    const size = input.size ?? Buffer.byteLength(content);
    let tokens = 0;
    if (!binary) {
        tokens = oversized && content.length === 0
            ? Math.max(1, Math.ceil(size / 4))
            : estimateTokens(content);
    }
    return {
        path: toPosix(input.path),
        content: binary ? '' : content,
        size,
        mtimeMs: input.mtimeMs ?? 0,
        binary,
        oversized,
        tokens,
    };
}
function sortFindings(findings) {
    const order = new Map(DIMENSION_IDS.map((id, index) => [id, index]));
    return [...findings].sort((a, b) => {
        const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (severity !== 0)
            return severity;
        const dimension = (order.get(a.dimension) ?? 0) - (order.get(b.dimension) ?? 0);
        if (dimension !== 0)
            return dimension;
        const file = (a.file ?? '').localeCompare(b.file ?? '');
        if (file !== 0)
            return file;
        return (a.line ?? 0) - (b.line ?? 0) || a.ruleId.localeCompare(b.ruleId);
    });
}
function sanitizeNotes(notes) {
    if (!notes)
        return [];
    const clean = [];
    for (const note of notes.slice(0, 20)) {
        const text = String(note).replace(/\s+/g, ' ').trim().slice(0, 500);
        if (!text)
            continue;
        clean.push(containsCredentialPattern(text)
            ? '[llm note redacted because it contained a credential-like pattern]'
            : text);
    }
    return clean;
}
export async function scoreContext(options = {}) {
    const started = Date.now();
    const cwd = resolve(options.cwd ?? process.cwd());
    const config = options.config ?? loadConfig(options);
    let files = [];
    let kind = 'pack';
    let root = options.rootLabel ?? '.';
    let rootAbs;
    const hasPaths = (options.paths?.length ?? 0) > 0 || Boolean(options.listFile);
    if (options.files) {
        files = options.files.map(normalizeInput);
        kind = options.kind ?? (files.length <= 1 ? 'single' : 'pack');
        root = options.rootLabel ?? 'memory';
    }
    else if (hasPaths) {
        const found = discover({
            cwd,
            paths: options.paths ?? [],
            ...(options.listFile ? { listFile: options.listFile } : {}),
            config,
            ...(options.extraIgnore ? { extraIgnore: options.extraIgnore } : {}),
        });
        files = found.files;
        kind = found.kind;
        root = found.root;
        rootAbs = found.rootAbs;
    }
    else if (options.stdin === undefined) {
        throw new CqsError('Nothing to score. Pass a path, --list, or --stdin.', 2);
    }
    if (options.stdin !== undefined) {
        const hadFiles = files.length > 0;
        files = [...files, normalizeInput({ path: '<stdin>', content: options.stdin, mtimeMs: 0 })];
        kind = hadFiles ? 'pack' : 'single';
        if (!hadFiles)
            root = '<stdin>';
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    const relevance = scoreRelevance(files);
    const drafts = [
        relevance,
        scoreFreshness(files, kind, config, relevance.noisePaths),
        scoreCompleteness(files, kind, relevance.noisePaths, rootAbs),
        scoreTokens(files, config),
        scoreStructure(files, kind),
        scoreSecrets(files),
    ];
    const unreadable = files.filter((file) => file.unreadable).map((file) => ({
        ruleId: 'pack/unreadable',
        dimension: 'completeness',
        severity: 'note',
        file: file.path,
        message: 'File could not be read and was skipped.',
    }));
    const dimensions = drafts.map((draft) => ({
        id: draft.id,
        label: DIMENSION_LABELS[draft.id],
        score: draft.score,
        weight: config.weights[draft.id],
        details: draft.details,
        findings: sortFindings(draft.findings).slice(0, 50),
    }));
    let findings = sortFindings([...drafts.flatMap((draft) => draft.findings), ...unreadable]).slice(0, 200);
    let suggestions = buildSuggestions(dimensions, findings, kind);
    let overall = 0;
    for (const dimension of dimensions)
        overall += dimension.score * dimension.weight;
    overall = roundScore(overall);
    if (files.length === 0) {
        overall = 0;
        for (const dimension of dimensions) {
            dimension.score = 0;
            dimension.findings = [];
        }
        suggestions = [];
        findings = [{
                ruleId: 'pack/empty',
                dimension: 'completeness',
                severity: 'error',
                message: 'No files matched. Check the path and the ignore globs.',
            }];
    }
    const secretError = findings.some((finding) => finding.dimension === 'secrets' && finding.severity === 'error');
    const passed = files.length > 0 && overall >= config.threshold && !(config.failOnSecrets && secretError);
    const report = {
        tool: 'cqs',
        version: VERSION,
        overall,
        grade: gradeFor(overall),
        passed,
        threshold: config.threshold,
        failOnSecrets: config.failOnSecrets,
        root,
        kind,
        filesScanned: files.length,
        tokensEstimated: files.reduce((sum, file) => sum + file.tokens, 0),
        bytes: files.reduce((sum, file) => sum + file.size, 0),
        elapsedMs: Date.now() - started,
        dimensions,
        findings,
        suggestions,
        llm: {
            enabled: config.llm.enabled,
            executed: false,
            notes: config.llm.enabled && !options.llmReviewer
                ? ['LLM hook is enabled in config, but this run did not execute it. The score is heuristic-only and offline.']
                : [],
        },
    };
    if (config.llm.enabled && options.llmReviewer) {
        try {
            const notes = await options.llmReviewer({
                files: files.map((file) => ({ path: file.path, tokens: file.tokens })),
                report,
            });
            report.llm = { enabled: true, executed: true, notes: sanitizeNotes(notes) };
        }
        catch {
            report.llm = {
                enabled: true,
                executed: false,
                notes: ['LLM hook failed. The heuristic score is unchanged.'],
            };
        }
    }
    return report;
}
//# sourceMappingURL=score.js.map