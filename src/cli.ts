#!/usr/bin/env node

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { writeDefaultConfig } from './config.js';
import { formatReport, renderAnnotations, renderMarkdown, renderSarif, renderSuggestions } from './report/index.js';
import { scoreContext } from './score.js';
import type { ReportFormat } from './types.js';
import { CqsError } from './util.js';
import { VERSION } from './version.js';

const HELP = `cqs ${VERSION} — context quality score for coding-agent context packs

Usage:
  cqs score [paths...] [options]
  cqs suggest [paths...] [options]
  cqs init [dir] [options]
  cqs --help
  cqs --version

Score a folder, a list of files, one prompt file, or stdin.
Scoring is deterministic and offline. No API key. No LLM call.
An optional LLM hook in config is ignored unless a reviewer is injected
from the library API, and it never changes the numeric score.

Commands:
  score      Score a context pack (default when paths are given)
  suggest    Print ranked edits that would raise the score
  init       Write .cqs.json in the current directory, or in [dir]

Options:
  -c, --config <file>         Config JSON (default: search for .cqs.json)
  -f, --format <name>         pretty | json | markdown | sarif | github
      --json                  Same as --format json
  -o, --output <file>         Write the selected format to a file
      --markdown-out <file>   Also write a Markdown report
      --sarif-out <file>      Also write SARIF 2.1.0
      --annotations           Print GitHub Actions annotations on stderr
      --threshold <n>         Exit 1 when the overall score is below n
      --fail-under <n>        Alias of --threshold
      --fail-on-secrets       Exit 1 when a secret finding has severity error
      --ignore <glob>         Extra ignore glob (repeatable)
      --no-ignore-defaults    Do not apply the built-in ignore globs
      --list <file>           Newline-separated file list
      --stdin                 Read an additional context file from stdin
      --max-file-bytes <n>    Do not read files larger than n bytes
      --limit <n>             Suggestion count for \`cqs suggest\` (default 20)
  -q, --quiet                 With the pretty format, print only the score
      --no-color              Disable ANSI color
      --force                 Overwrite an existing config during init
  -h, --help                  Show this help
  -v, --version               Show the version

Exit codes:
  0  Score computed and the threshold was met
  1  Score below --threshold, or secrets found with --fail-on-secrets
  2  Invalid usage
  3  Config or filesystem error

Examples:
  cqs score .
  cqs score examples/fixture-pack --threshold 60
  cqs score docs/prompt.md --format markdown
  cat docs/prompt.md | cqs score --stdin --json
  cqs suggest . --limit 5
  cqs init
`;

type Command = 'score' | 'suggest' | 'init' | 'help' | 'version';

interface Args {
  command: Command;
  paths: string[];
  format: ReportFormat;
  output?: string;
  markdownOut?: string;
  sarifOut?: string;
  config?: string;
  threshold?: number;
  ignore: string[];
  stdin: boolean;
  listFile?: string;
  quiet: boolean;
  noColor: boolean;
  force: boolean;
  limit: number;
  failOnSecrets?: boolean;
  maxFileBytes?: number;
  annotations: boolean;
  noDefaultIgnores: boolean;
  help: boolean;
  version: boolean;
}

const FORMATS = new Set<ReportFormat>(['pretty', 'json', 'markdown', 'sarif', 'github']);

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: 'score',
    paths: [],
    format: 'pretty',
    ignore: [],
    stdin: false,
    quiet: false,
    noColor: false,
    force: false,
    limit: 20,
    annotations: false,
    noDefaultIgnores: false,
    help: false,
    version: false,
  };
  let i = 0;
  const head = argv[0];
  if (head === 'score' || head === 'suggest' || head === 'init' || head === 'help' || head === 'version') {
    args.command = head;
    i = 1;
  }
  for (; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === undefined) continue;
    if (token === '--') {
      args.paths.push(...argv.slice(i + 1));
      break;
    }
    if (token === '-') {
      args.stdin = true;
      continue;
    }
    if (!token.startsWith('-')) {
      args.paths.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    const flag = eq === -1 ? token : token.slice(0, eq);
    const inline = eq === -1 ? undefined : token.slice(eq + 1);
    const value = (): string => {
      if (inline !== undefined) return inline;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new CqsError(`Missing value for ${flag}`, 2);
      }
      i += 1;
      return next;
    };
    switch (flag) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      case '--json':
        args.format = 'json';
        break;
      case '-f':
      case '--format': {
        const name = value();
        if (!FORMATS.has(name as ReportFormat)) {
          throw new CqsError(`Unknown format "${name}". Expected pretty, json, markdown, sarif, or github.`, 2);
        }
        args.format = name as ReportFormat;
        break;
      }
      case '-o':
      case '--output':
        args.output = value();
        break;
      case '--markdown-out':
        args.markdownOut = value();
        break;
      case '--sarif-out':
        args.sarifOut = value();
        break;
      case '-c':
      case '--config':
        args.config = value();
        break;
      case '--threshold':
      case '--fail-under':
        args.threshold = parseScore(flag, value());
        break;
      case '--fail-on-secrets':
        args.failOnSecrets = true;
        break;
      case '--ignore':
        args.ignore.push(value());
        break;
      case '--no-ignore-defaults':
        args.noDefaultIgnores = true;
        break;
      case '--list':
        args.listFile = value();
        break;
      case '--stdin':
        args.stdin = true;
        break;
      case '--max-file-bytes':
        args.maxFileBytes = parsePositive(flag, value());
        break;
      case '--limit':
        args.limit = parsePositive(flag, value());
        break;
      case '-q':
      case '--quiet':
        args.quiet = true;
        break;
      case '--no-color':
        args.noColor = true;
        break;
      case '--annotations':
        args.annotations = true;
        break;
      case '--force':
        args.force = true;
        break;
      default:
        throw new CqsError(`Unknown option: ${flag}`, 2);
    }
  }
  if (args.help) args.command = 'help';
  else if (args.version && args.paths.length === 0 && args.command === 'score' && !args.stdin && !args.listFile) {
    args.command = 'version';
  }
  return args;
}

function parseScore(flag: string, raw: string): number {
  if (!/^\d{1,3}$/.test(raw)) throw new CqsError(`${flag} expects an integer from 0 to 100.`, 2);
  const n = Number(raw);
  if (n > 100) throw new CqsError(`${flag} expects an integer from 0 to 100.`, 2);
  return n;
}

function parsePositive(flag: string, raw: string): number {
  if (!/^\d+$/.test(raw) || Number(raw) < 1) throw new CqsError(`${flag} expects a positive integer.`, 2);
  return Number(raw);
}

function colorEnabled(noColor: boolean): boolean {
  if (noColor) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  return process.stdout.isTTY === true;
}

function readStdin(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    throw new CqsError('Failed to read stdin.', 3);
  }
}

async function run(args: Args): Promise<number> {
  if (args.command === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.command === 'version') {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (args.command === 'init') {
    if (args.paths.length > 1) throw new CqsError('init accepts at most one directory.', 2);
    const dir = resolve(args.paths[0] ?? process.cwd());
    const written = writeDefaultConfig(dir, args.force);
    process.stdout.write(`Wrote ${written}\n`);
    return 0;
  }

  const wantsStdin = args.stdin || (args.paths.length === 0 && !args.listFile && process.stdin.isTTY !== true);
  if (args.paths.length === 0 && !args.listFile && !wantsStdin) {
    process.stderr.write('Nothing to score. Pass a path, or pipe a prompt on stdin.\n\n');
    process.stdout.write(HELP);
    return 2;
  }

  const report = await scoreContext({
    cwd: process.cwd(),
    paths: args.paths,
    ...(args.listFile ? { listFile: args.listFile } : {}),
    ...(wantsStdin ? { stdin: readStdin() } : {}),
    ...(args.config ? { configPath: args.config } : {}),
    ...(args.threshold !== undefined ? { threshold: args.threshold } : {}),
    ...(args.failOnSecrets !== undefined ? { failOnSecrets: args.failOnSecrets } : {}),
    ...(args.maxFileBytes !== undefined ? { maxFileBytes: args.maxFileBytes } : {}),
    ...(args.ignore.length > 0 ? { extraIgnore: args.ignore } : {}),
    ...(args.noDefaultIgnores ? { noDefaultIgnores: true } : {}),
  });

  if (args.format === 'github') {
    const output = process.env.GITHUB_OUTPUT;
    if (output) {
      appendFileSync(output, `score=${report.overall}\ngrade=${report.grade}\npassed=${report.passed ? 'true' : 'false'}\n`);
    }
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, renderMarkdown(report));
  }

  let text: string;
  if (args.command === 'suggest' && args.format === 'pretty') {
    text = args.quiet ? `${report.overall}\n` : renderSuggestions(report, args.limit);
  } else if (args.quiet && args.format === 'pretty') {
    text = `${report.overall}\n`;
  } else {
    text = formatReport(report, args.format, colorEnabled(args.noColor));
  }

  if (args.annotations && args.format !== 'github') {
    const notes = renderAnnotations(report);
    if (notes) process.stderr.write(`${notes}\n`);
  }
  if (args.markdownOut) writeFileSync(resolve(args.markdownOut), renderMarkdown(report));
  if (args.sarifOut) writeFileSync(resolve(args.sarifOut), `${JSON.stringify(renderSarif(report), null, 2)}\n`);
  if (args.output) {
    writeFileSync(resolve(args.output), text);
    if (!args.quiet) process.stderr.write(`Wrote ${args.output}\n`);
  } else {
    process.stdout.write(text);
  }
  if (report.llm.enabled && !report.llm.executed) {
    process.stderr.write('warning: llm.enabled is true, but cqs did not run an LLM. The score is heuristic-only.\n');
  }
  return report.passed ? 0 : 1;
}

async function main(): Promise<void> {
  try {
    const code = await run(parseArgs(process.argv.slice(2)));
    process.exit(code);
  } catch (error) {
    if (error instanceof CqsError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(error.exitCode);
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`cqs: ${message}\n`);
    process.exit(3);
  }
}

void main();
