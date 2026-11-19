import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function runCli(args: string[], options: { input?: string; cwd?: string } = {}) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', path.join(repoRoot, 'src/cli.ts'), ...args],
    {
      cwd: options.cwd ?? repoRoot,
      encoding: 'utf8',
      input: options.input,
      env: { ...process.env, NO_COLOR: '1' },
    },
  );
}

export function stringsOf(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) stringsOf(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) stringsOf(item, found);
  }
  return found;
}
