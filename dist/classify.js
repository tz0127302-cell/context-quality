import { basename, extname } from './util.js';
const CODE_EXTS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
    '.py', '.pyi', '.go', '.rs', '.java', '.kt', '.kts', '.rb', '.php',
    '.cs', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.hh', '.swift',
    '.scala', '.vue', '.svelte', '.sql',
]);
const DOC_EXTS = new Set(['.md', '.mdx', '.rst', '.adoc', '.txt', '.markdown']);
const LOCKFILES = new Set([
    'package-lock.json',
    'npm-shrinkwrap.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lock',
    'bun.lockb',
    'cargo.lock',
    'gemfile.lock',
    'poetry.lock',
    'pipfile.lock',
    'composer.lock',
    'packages.lock.json',
    'uv.lock',
    'go.sum',
    'gradle.lockfile',
]);
const MANIFESTS = new Set([
    'package.json',
    'pyproject.toml',
    'cargo.toml',
    'go.mod',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'composer.json',
    'gemfile',
]);
const ENTRY_BASENAMES = new Set([
    'index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.cjs',
    'main.ts', 'main.js', 'main.py', 'main.go', 'main.rs',
    'cli.ts', 'cli.js', 'app.ts', 'app.js', 'server.ts', 'server.js',
    'mod.rs', 'lib.rs', '__init__.py', '__main__.py',
]);
const VENDOR_SEGMENTS = new Set([
    'vendor', 'vendored', 'third_party', 'third-party', 'externals', 'external', 'node_modules',
]);
export function isCodePath(p) {
    return CODE_EXTS.has(extname(p));
}
export function isDocPath(p) {
    if (p === '<stdin>')
        return true;
    const base = basename(p).toLowerCase();
    if (base === 'agents.md' || base === 'agent.md' || base === 'claude.md')
        return true;
    if (base.startsWith('readme'))
        return true;
    if (DOC_EXTS.has(extname(p)))
        return true;
    return false;
}
export function isReadme(p) {
    return /^readme($|\.)/i.test(basename(p));
}
export function isAgentGuide(p) {
    const base = basename(p).toLowerCase();
    if (['agents.md', 'agent.md', 'claude.md', 'copilot-instructions.md', '.cursorrules'].includes(base)) {
        return true;
    }
    return p.toLowerCase().replace(/\\/g, '/').endsWith('.github/copilot-instructions.md');
}
export function isLockfile(p) {
    return LOCKFILES.has(basename(p).toLowerCase());
}
export function isManifest(p) {
    return MANIFESTS.has(basename(p).toLowerCase());
}
export function isEntrypointBasename(p) {
    return ENTRY_BASENAMES.has(basename(p).toLowerCase());
}
export function isVendoredPath(p) {
    return p.split('/').some((seg) => VENDOR_SEGMENTS.has(seg.toLowerCase()));
}
export function isJsTs(p) {
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'].includes(extname(p));
}
const UNSAFE_DOTENV = /(?:^|\/)\.env(?:\.|$)/i;
const SAFE_DOTENV = /(?:^|\/)\.env\.(?:example|sample|template|dist)(?:\.|$)/i;
export function isUnsafeDotenv(p) {
    const norm = p.replace(/\\/g, '/');
    if (!UNSAFE_DOTENV.test(norm))
        return false;
    return !SAFE_DOTENV.test(norm);
}
//# sourceMappingURL=classify.js.map