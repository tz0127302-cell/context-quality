import { existsSync } from 'node:fs';
import path from 'node:path';
import { isCodePath, isDocPath, isJsTs, isReadme } from '../classify.js';
import { containsCredentialPattern } from '../credentials.js';
import { RUBRIC } from '../rubric.js';
import { lineAt, roundScore } from '../util.js';
const LINK_RE = /!?\[[^\]]*\]\(([^)]+)\)/g;
const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)|require\(\s*['"](\.[^'"]+)['"]\s*\)/g;
function stripTarget(raw) {
    let target = raw.trim();
    if (target.startsWith('<') && target.includes('>'))
        target = target.slice(1, target.indexOf('>'));
    const title = target.search(/\s+["']/);
    if (title !== -1)
        target = target.slice(0, title);
    return target.trim();
}
function isSkippableLink(target) {
    if (target.length === 0 || target.startsWith('#'))
        return true;
    if (target.startsWith('//'))
        return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target))
        return true;
    return false;
}
function fileSetOf(files) {
    return new Set(files.map((file) => file.path));
}
function resolveInside(fromFile, spec) {
    const dir = path.posix.dirname(fromFile);
    const joined = path.posix.normalize(path.posix.join(dir, spec));
    return joined;
}
const EXT_CANDIDATES = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.json', '.d.ts', '.md', '.mdx'];
function candidatesFor(resolved) {
    const out = [resolved];
    for (const ext of EXT_CANDIDATES)
        out.push(resolved + ext);
    for (const ext of ['.ts', '.tsx', '.js', '.jsx'])
        out.push(`${resolved}/index${ext}`);
    if (resolved.endsWith('.js')) {
        const stem = resolved.slice(0, -3);
        out.push(`${stem}.ts`, `${stem}.tsx`, `${stem}.d.ts`);
    }
    if (resolved.endsWith('.mjs'))
        out.push(`${resolved.slice(0, -4)}.mts`);
    if (resolved.endsWith('.cjs'))
        out.push(`${resolved.slice(0, -4)}.cts`);
    return out;
}
function existsInPack(resolved, files, rootAbs) {
    if (resolved.startsWith('..')) {
        if (!rootAbs)
            return false;
        return existsSync(path.resolve(rootAbs, resolved));
    }
    if (candidatesFor(resolved).some((candidate) => files.has(candidate)))
        return true;
    if (!rootAbs)
        return false;
    return candidatesFor(resolved).some((candidate) => existsSync(path.resolve(rootAbs, candidate)));
}
function hasImplementation(files, noisePaths) {
    return files.some((file) => !noisePaths.has(file.path)
        && !file.binary
        && !file.oversized
        && isCodePath(file.path)
        && /\b(function|class|def |func )\b/.test(file.content));
}
function hasInterfaceSignal(files) {
    for (const file of files) {
        if (file.binary || file.oversized || file.unreadable)
            continue;
        if (file.path.endsWith('.d.ts') || /(?:^|\/)types\.[a-z0-9]+$/i.test(file.path))
            return true;
        if (/export\s+(interface|type)\s+/.test(file.content))
            return true;
        if (/^#{1,6}\s+.*\bAPI\b/im.test(file.content))
            return true;
        if (/\/\*\*[\s\S]{0,500}?\*\/\s*export\s+(async\s+)?(function|class|const)\b/.test(file.content))
            return true;
    }
    return false;
}
export function scoreCompleteness(files, kind, noisePaths, rootAbs) {
    const findings = [];
    const known = fileSetOf(files);
    let brokenRefs = 0;
    let brokenImports = 0;
    let emptyFiles = 0;
    for (const file of files) {
        if (file.binary || file.oversized || file.unreadable || file.path === '<stdin>')
            continue;
        if (file.content.trim().length === 0) {
            emptyFiles += 1;
            findings.push({
                ruleId: 'completeness/empty-file',
                dimension: 'completeness',
                severity: 'warning',
                file: file.path,
                line: 1,
                message: 'Empty file. Remove it or add the content an agent would need.',
            });
        }
        if (isDocPath(file.path)) {
            LINK_RE.lastIndex = 0;
            for (const match of file.content.matchAll(LINK_RE)) {
                const raw = match[1];
                if (!raw || match.index === undefined)
                    continue;
                const target = stripTarget(raw).split('#')[0]?.split('?')[0]?.trim() ?? '';
                if (isSkippableLink(target) || target.startsWith('/'))
                    continue;
                const resolved = resolveInside(file.path, target);
                if (existsInPack(resolved, known, rootAbs))
                    continue;
                brokenRefs += 1;
                findings.push({
                    ruleId: 'completeness/broken-ref',
                    dimension: 'completeness',
                    severity: 'warning',
                    file: file.path,
                    line: lineAt(file.content, match.index),
                    message: containsCredentialPattern(target)
                        ? 'Broken relative reference. The target looked like a credential and was redacted.'
                        : `Broken relative reference to ${target}.`,
                    ...(containsCredentialPattern(target) ? {} : { data: { target: target.slice(0, 200) } }),
                });
            }
        }
        if (!isJsTs(file.path))
            continue;
        IMPORT_RE.lastIndex = 0;
        for (const match of file.content.matchAll(IMPORT_RE)) {
            const spec = match[1] ?? match[2] ?? match[3];
            if (!spec || match.index === undefined)
                continue;
            const resolved = resolveInside(file.path, spec);
            if (existsInPack(resolved, known, rootAbs))
                continue;
            brokenImports += 1;
            findings.push({
                ruleId: 'completeness/broken-import',
                dimension: 'completeness',
                severity: 'warning',
                file: file.path,
                line: lineAt(file.content, match.index),
                message: `Unresolved relative import ${spec}.`,
                data: { target: spec.slice(0, 200) },
            });
        }
    }
    const hasReadme = files.some((file) => isReadme(file.path));
    if (kind === 'pack' && !hasReadme) {
        findings.push({
            ruleId: 'completeness/missing-readme',
            dimension: 'completeness',
            severity: 'warning',
            message: 'Multi-file pack has no README. Add one that states the task, the entrypoint, and the constraints.',
        });
    }
    const missingInterface = kind === 'pack' && hasImplementation(files, noisePaths) && !hasInterfaceSignal(files);
    if (missingInterface) {
        findings.push({
            ruleId: 'completeness/missing-interface',
            dimension: 'completeness',
            severity: 'warning',
            message: 'Implementations exist without a types module, exported interface, JSDoc on exports, or an API heading.',
        });
    }
    let penalty = 0;
    if (kind === 'pack' && !hasReadme)
        penalty += RUBRIC.completeness.missingReadme;
    penalty += Math.min(RUBRIC.completeness.brokenRefCap, brokenRefs * RUBRIC.completeness.brokenRef);
    if (missingInterface)
        penalty += RUBRIC.completeness.missingInterface;
    penalty += Math.min(RUBRIC.completeness.brokenImportCap, brokenImports * RUBRIC.completeness.brokenImport);
    penalty += Math.min(RUBRIC.completeness.emptyFileCap, emptyFiles * RUBRIC.completeness.emptyFile);
    return {
        id: 'completeness',
        score: roundScore(100 - penalty),
        findings,
        details: {
            hasReadme,
            brokenRefs,
            brokenImports,
            emptyFiles,
            missingInterface,
        },
    };
}
//# sourceMappingURL=completeness.js.map