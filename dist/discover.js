import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { effectiveIgnore } from './config.js';
import { compileGlobs, isIgnored } from './ignore.js';
import { estimateTokens } from './tokens.js';
import { CqsError, extname, toPosix } from './util.js';
const BINARY_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.tgz',
    '.bz2', '.7z', '.wasm', '.mp3', '.mp4', '.mov', '.avi', '.woff', '.woff2', '.ttf', '.eot',
    '.otf', '.so', '.dylib', '.dll', '.exe', '.bin', '.jar', '.class', '.pyc', '.o', '.a',
]);
function displayPath(cwd, abs) {
    const rel = relative(cwd, abs);
    if (rel === '' || rel.startsWith('..') || rel.includes(`..${sep}`))
        return toPosix(abs);
    return toPosix(rel);
}
function readList(file) {
    let text;
    try {
        text = readFileSync(file, 'utf8');
    }
    catch {
        throw new CqsError(`Cannot read file list: ${file}`, 3);
    }
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
}
function loadFile(abs, relPosix, config) {
    let st;
    try {
        st = statSync(abs);
    }
    catch {
        throw new CqsError(`Cannot stat file: ${abs}`, 3);
    }
    const ext = extname(relPosix);
    if (BINARY_EXTS.has(ext)) {
        return {
            path: relPosix,
            content: '',
            size: st.size,
            mtimeMs: st.mtimeMs,
            binary: true,
            oversized: false,
            tokens: 0,
        };
    }
    if (st.size > config.maxFileBytes) {
        return {
            path: relPosix,
            content: '',
            size: st.size,
            mtimeMs: st.mtimeMs,
            binary: false,
            oversized: true,
            tokens: Math.max(1, Math.ceil(st.size / 4)),
        };
    }
    let buf;
    try {
        buf = readFileSync(abs);
    }
    catch {
        return {
            path: relPosix,
            content: '',
            size: st.size,
            mtimeMs: st.mtimeMs,
            binary: false,
            oversized: false,
            unreadable: true,
            tokens: 0,
        };
    }
    if (buf.includes(0)) {
        return {
            path: relPosix,
            content: '',
            size: st.size,
            mtimeMs: st.mtimeMs,
            binary: true,
            oversized: false,
            tokens: 0,
        };
    }
    const content = buf.toString('utf8');
    return {
        path: relPosix,
        content,
        size: st.size,
        mtimeMs: st.mtimeMs,
        binary: false,
        oversized: false,
        tokens: estimateTokens(content),
    };
}
function walk(rootAbs, dirAbs, rootForRel, regexes, config, out, seen) {
    if (out.length > config.maxFiles)
        return;
    let entries;
    try {
        entries = readdirSync(dirAbs, { withFileTypes: true });
    }
    catch {
        return;
    }
    const names = entries.map((e) => e.name).sort((a, b) => a.localeCompare(b));
    for (const name of names) {
        if (name === '.git')
            continue;
        const ent = entries.find((e) => e.name === name);
        if (!ent || ent.isSymbolicLink())
            continue;
        const abs = join(dirAbs, name);
        const rel = toPosix(relative(rootForRel, abs));
        if (ent.isDirectory()) {
            if (isIgnored(rel, regexes, 'dir'))
                continue;
            walk(rootAbs, abs, rootForRel, regexes, config, out, seen);
            continue;
        }
        if (!ent.isFile())
            continue;
        if (isIgnored(rel, regexes, 'file'))
            continue;
        if (seen.has(abs))
            continue;
        seen.add(abs);
        out.push(loadFile(abs, rel, config));
        if (out.length > config.maxFiles) {
            throw new CqsError(`More than ${config.maxFiles} files matched. Narrow the path or raise maxFiles.`, 3);
        }
    }
}
export function discover(options) {
    const cwd = resolve(options.cwd);
    const requested = [...options.paths];
    if (options.listFile) {
        requested.push(...readList(resolve(cwd, options.listFile)));
    }
    if (requested.length === 0) {
        throw new CqsError('Nothing to score. Pass a path, --list, or --stdin.', 2);
    }
    const regexes = compileGlobs(effectiveIgnore(options.config, options.extraIgnore));
    const absPaths = requested.map((p) => resolve(cwd, p));
    for (const abs of absPaths) {
        if (!statExists(abs))
            throw new CqsError(`Path not found: ${abs}`, 3);
    }
    const files = [];
    const seen = new Set();
    if (absPaths.length === 1) {
        const only = absPaths[0];
        const st = statSync(only);
        if (st.isFile()) {
            const relName = toPosix(relative(resolve(only, '..'), only));
            files.push(loadFile(only, relName, options.config));
            return { files, root: displayPath(cwd, only), rootAbs: resolve(only, '..'), kind: 'single' };
        }
        if (!st.isDirectory())
            throw new CqsError(`Not a file or directory: ${only}`, 3);
        walk(only, only, only, regexes, options.config, files, seen);
        files.sort((a, b) => a.path.localeCompare(b.path));
        return { files, root: displayPath(cwd, only), rootAbs: only, kind: 'pack' };
    }
    for (const abs of absPaths) {
        const st = statSync(abs);
        if (st.isFile()) {
            if (seen.has(abs))
                continue;
            seen.add(abs);
            const rel = displayPath(cwd, abs);
            files.push(loadFile(abs, rel, options.config));
            continue;
        }
        if (st.isDirectory()) {
            walk(abs, abs, cwd, regexes, options.config, files, seen);
        }
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return { files, root: '.', rootAbs: cwd, kind: 'pack' };
}
function statExists(abs) {
    try {
        statSync(abs);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=discover.js.map