import { CqsError } from './util.js';
export const DEFAULT_IGNORE = [
    '**/.git/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/.cache/**',
    '**/target/**',
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.webp',
    '**/*.ico',
    '**/*.pdf',
    '**/*.zip',
    '**/*.tar',
    '**/*.gz',
    '**/*.tgz',
    '**/*.wasm',
    '**/*.woff',
    '**/*.woff2',
    '**/*.mp4',
    '**/*.mp3',
];
function escapeChar(c) {
    return /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
}
/** Convert a small glob subset (`*`, `?`, `**`) into a full-path regular expression. */
export function globToRegExp(raw) {
    let g = raw.trim().replace(/\\/g, '/');
    if (g.startsWith('./'))
        g = g.slice(2);
    if (g.startsWith('/'))
        g = g.slice(1);
    let directoryOnly = false;
    if (g.endsWith('/')) {
        directoryOnly = true;
        g = g.slice(0, -1);
    }
    if (g.length === 0) {
        throw new CqsError(`Invalid ignore glob: ${raw}`, 3);
    }
    const hasSlash = g.includes('/');
    let re = '';
    for (let i = 0; i < g.length; i += 1) {
        const c = g[i];
        if (c === '*') {
            if (g[i + 1] === '*') {
                i += 1;
                if (g[i + 1] === '/') {
                    i += 1;
                    re += '(?:[^/]+/)*';
                }
                else {
                    re += '.*';
                }
            }
            else {
                re += '[^/]*';
            }
        }
        else if (c === '?') {
            re += '[^/]';
        }
        else if (c === '/') {
            re += '/';
        }
        else {
            re += escapeChar(c);
        }
    }
    if (!hasSlash)
        re = `(?:[^/]+/)*${re}`;
    if (directoryOnly)
        re = `${re}(?:/.*)?`;
    return new RegExp(`^${re}$`);
}
export function compileGlobs(patterns) {
    return patterns.map((pattern) => globToRegExp(pattern));
}
export function isIgnored(relPath, regexes, kind) {
    const p = relPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
    if (p.length === 0)
        return false;
    if (regexes.some((re) => re.test(p)))
        return true;
    if (kind === 'dir' && regexes.some((re) => re.test(`${p}/__cqs_probe__`)))
        return true;
    return false;
}
//# sourceMappingURL=ignore.js.map