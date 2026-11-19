import { createHash } from 'node:crypto';
import { isLockfile, isVendoredPath } from '../classify.js';
import { RUBRIC } from '../rubric.js';
import { basename, roundScore } from '../util.js';
function junkRank(filePath) {
    return /(^|\/)(notes|copies|copy|dup|duplicate|tmp|temp)\//i.test(filePath) ? 1 : 0;
}
function compareCanonical(a, b) {
    const rank = junkRank(a) - junkRank(b);
    if (rank !== 0)
        return rank;
    if (a.length !== b.length)
        return a.length - b.length;
    return a < b ? -1 : a > b ? 1 : 0;
}
/** Map of duplicate path to the canonical path that should be kept. */
export function duplicateMap(files) {
    const groups = new Map();
    for (const file of files) {
        if (file.binary || file.oversized || file.unreadable)
            continue;
        if (file.content.trim().length < 20)
            continue;
        const hash = createHash('sha256').update(file.content.replace(/\r\n/g, '\n').trim()).digest('hex');
        const list = groups.get(hash);
        if (list)
            list.push(file);
        else
            groups.set(hash, [file]);
    }
    const dupes = new Map();
    for (const group of groups.values()) {
        if (group.length < 2)
            continue;
        const sorted = [...group].sort((a, b) => compareCanonical(a.path, b.path));
        const canon = sorted[0];
        if (!canon)
            continue;
        for (const other of sorted.slice(1))
            dupes.set(other.path, canon.path);
    }
    return dupes;
}
function isMinified(file) {
    if (/\.min\.(js|css|mjs|cjs)$/i.test(file.path))
        return true;
    if (file.content.length > 2000) {
        const lines = file.content.split(/\r?\n/).length || 1;
        if (file.content.length / lines > 300)
            return true;
    }
    return false;
}
function classify(file, dupes) {
    if (file.binary)
        return 'binary';
    if (file.oversized)
        return 'oversized';
    if (isLockfile(file.path))
        return 'lockfile';
    if (isVendoredPath(file.path))
        return 'vendored';
    if (!file.unreadable && isMinified(file))
        return 'minified';
    if (dupes.has(file.path))
        return 'duplicate';
    return undefined;
}
function findingFor(file, kind, canonical) {
    const base = {
        dimension: 'relevance',
        file: file.path,
        line: 1,
        severity: 'warning',
    };
    switch (kind) {
        case 'lockfile':
            return {
                ...base,
                ruleId: 'relevance/lockfile',
                message: `Lockfile ${basename(file.path)} is dependency metadata. It rarely helps a coding agent and spends tokens.`,
            };
        case 'duplicate':
            return {
                ...base,
                ruleId: 'relevance/duplicate',
                message: `Duplicate of ${canonical ?? 'another file'}. Extra copies add noise without new signal.`,
                ...(canonical ? { data: { canonical } } : {}),
            };
        case 'minified':
            return {
                ...base,
                ruleId: 'relevance/minified',
                message: 'Minified or generated bundle. Prefer the source that produced it.',
            };
        case 'vendored':
            return {
                ...base,
                ruleId: 'relevance/vendored',
                message: 'Vendored dependency tree. Keep third-party code out of the pack unless the task is to modify it.',
            };
        case 'binary':
            return {
                ...base,
                ruleId: 'relevance/binary',
                message: 'Binary file. Agents cannot read it as context; leave it out of the pack.',
            };
        case 'oversized':
            return {
                ...base,
                ruleId: 'relevance/oversized',
                message: `File exceeds the max read size (${file.size} bytes) and was not inspected.`,
            };
        default:
            return { ...base, ruleId: 'relevance/noise', message: 'Low-signal file.' };
    }
}
export function scoreRelevance(files) {
    const dupes = duplicateMap(files);
    const findings = [];
    const noisePaths = new Set();
    let noiseBytes = 0;
    let noiseFiles = 0;
    let totalBytes = 0;
    for (const file of files) {
        totalBytes += file.size;
        const kind = classify(file, dupes);
        if (!kind)
            continue;
        noiseBytes += file.size;
        noiseFiles += 1;
        noisePaths.add(file.path);
        findings.push(findingFor(file, kind, dupes.get(file.path)));
    }
    let score = 100;
    if (files.length === 0 || totalBytes === 0)
        score = 0;
    else {
        const byteRatio = noiseBytes / totalBytes;
        const fileRatio = noiseFiles / files.length;
        score = roundScore(100 * (1 - RUBRIC.relevance.byteWeight * byteRatio - RUBRIC.relevance.fileWeight * fileRatio));
    }
    return {
        id: 'relevance',
        score,
        findings,
        details: { files: files.length, noiseFiles, noiseBytes, totalBytes },
        noisePaths,
    };
}
//# sourceMappingURL=relevance.js.map