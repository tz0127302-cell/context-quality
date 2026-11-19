import { isCodePath, isDocPath, isReadme } from '../classify.js';
import { daysBetween, latestEmbeddedDate, median } from '../dates.js';
import { RUBRIC } from '../rubric.js';
import type { DimensionDraft, Finding, LoadedFile, PackKind, ResolvedConfig } from '../types.js';
import { clamp, roundScore } from '../util.js';

interface DatedFile {
  file: LoadedFile;
  iso?: string;
  whenMs: number;
  embedded: boolean;
}

function stamp(file: LoadedFile): DatedFile {
  const found = latestEmbeddedDate(file.content);
  if (found) return { file, iso: found.iso, whenMs: found.utcMs, embedded: true };
  return { file, whenMs: file.mtimeMs, embedded: false };
}

function eligible(files: LoadedFile[], noisePaths: Set<string>, pred: (file: LoadedFile) => boolean): DatedFile[] {
  const out: DatedFile[] = [];
  for (const file of files) {
    if (file.path === '<stdin>' || file.binary || file.oversized || file.unreadable) continue;
    if (noisePaths.has(file.path)) continue;
    if (!pred(file)) continue;
    out.push(stamp(file));
  }
  return out;
}

function note(file: string | undefined, message: string, ruleId: string, severity: Finding['severity']): Finding {
  return {
    ruleId,
    dimension: 'freshness',
    severity,
    message,
    ...(file ? { file } : {}),
  };
}

function lineOf(content: string, iso: string | undefined): number {
  if (!iso) return 1;
  const lines = content.split(/\r?\n/);
  const idx = lines.findIndex((line) => line.includes(iso));
  return idx === -1 ? 1 : idx + 1;
}

function staleFinding(doc: DatedFile, codeIso: string | undefined, lagDays: number, staleDays: number): Finding {
  const docDate = doc.iso ?? 'mtime';
  const codeDate = codeIso ?? 'mtime';
  return {
    ruleId: 'freshness/stale-doc',
    dimension: 'freshness',
    severity: 'warning',
    file: doc.file.path,
    line: lineOf(doc.file.content, doc.iso),
    message: `Document is ${lagDays} days behind the newest code (${docDate} vs ${codeDate}). The stale window is ${staleDays} days.`,
    data: {
      lagDays,
      ...(doc.iso ? { docDate: doc.iso } : {}),
      ...(codeIso ? { codeDate: codeIso } : {}),
    },
  };
}

export function scoreFreshness(
  files: LoadedFile[],
  kind: PackKind,
  config: ResolvedConfig,
  noisePaths: Set<string>,
): DimensionDraft {
  if (kind === 'single') {
    const file = files[0];
    const doc = file ? isDocPath(file.path) : false;
    const code = file ? isCodePath(file.path) : false;
    const score = !file
      ? 0
      : doc
        ? RUBRIC.freshness.singleDocScore
        : code
          ? RUBRIC.freshness.singleCodeScore
          : RUBRIC.freshness.singleOtherScore;
    const message = !file
      ? 'No file to judge.'
      : doc
        ? 'Single document; no code in the pack to compare against.'
        : code
          ? 'Single source file; no companion doc to judge freshness.'
          : 'Single file; freshness is not comparable.';
    return {
      id: 'freshness',
      score,
      findings: [note(file?.path, message, 'freshness/single-file', 'note')],
      details: { mode: 'single' },
    };
  }

  const docs = eligible(files, noisePaths, (file) => isDocPath(file.path));
  const code = eligible(files, noisePaths, (file) => isCodePath(file.path));

  if (docs.length === 0) {
    return {
      id: 'freshness',
      score: RUBRIC.freshness.noDocsScore,
      findings: [note(undefined, 'No documentation files found to compare with the code.', 'freshness/no-docs', 'warning')],
      details: { docs: 0, code: code.length },
    };
  }
  if (code.length === 0) {
    return {
      id: 'freshness',
      score: RUBRIC.freshness.noCodeScore,
      findings: [note(docs[0]?.file.path, 'No source files found to compare with the docs.', 'freshness/no-code', 'note')],
      details: { docs: docs.length, code: 0 },
    };
  }

  const datedDocs = docs.filter((doc) => doc.embedded);
  const datedCode = code.filter((item) => item.embedded);
  const readme = docs.find((doc) => isReadme(doc.file.path));

  if (datedDocs.length === 0 || datedCode.length === 0) {
    if (datedDocs.length > 0 || datedCode.length > 0) {
      return {
        id: 'freshness',
        score: RUBRIC.freshness.mtimeFallbackScore,
        findings: [note(
          readme?.file.path ?? docs[0]?.file.path,
          'Dates are only on one side of the pack. Add Last updated: YYYY-MM-DD to the docs and @modified YYYY-MM-DD to the code so freshness does not depend on git checkout times.',
          'freshness/no-embedded-dates',
          'note',
        )],
        details: { usedMtime: true, datedDocs: datedDocs.length, datedCode: datedCode.length },
      };
    }
    return scoreByMtime(docs, code, readme, config);
  }

  const codeLatest = datedCode.reduce((best, item) => (item.whenMs > best.whenMs ? item : best));
  const primary = readme?.embedded
    ? readme
    : pickMedian(datedDocs);
  const lagDays = daysBetween(primary.whenMs, codeLatest.whenMs);
  const base = lagDays <= 0
    ? 100
    : roundScore(clamp(100 - (RUBRIC.freshness.lagScale * lagDays) / config.staleDays, RUBRIC.freshness.floor, 100));

  const findings: Finding[] = [];
  if (readme && !readme.embedded) {
    findings.push(note(
      readme.file.path,
      'README has no embedded Last updated date. Freshness used the other dated docs.',
      'freshness/no-embedded-dates',
      'note',
    ));
  }

  let extra = 0;
  let staleDocs = 0;
  for (const doc of datedDocs) {
    const docLag = daysBetween(doc.whenMs, codeLatest.whenMs);
    if (docLag <= config.staleDays) continue;
    staleDocs += 1;
    findings.push(staleFinding(doc, codeLatest.iso, docLag, config.staleDays));
    if (doc.file.path !== primary.file.path) extra += RUBRIC.freshness.extraStalePenalty;
  }

  return {
    id: 'freshness',
    score: roundScore(base - Math.min(RUBRIC.freshness.extraStaleCap, extra)),
    findings,
    details: {
      lagDays,
      primary: primary.file.path,
      code: codeLatest.file.path,
      staleDocs,
      usedMtime: false,
    },
  };
}

function pickMedian(docs: DatedFile[]): DatedFile {
  const sorted = [...docs].sort((a, b) => a.whenMs - b.whenMs);
  const target = median(sorted.map((doc) => doc.whenMs));
  return sorted.reduce((best, doc) =>
    Math.abs(doc.whenMs - target) < Math.abs(best.whenMs - target) ? doc : best,
  );
}

function scoreByMtime(
  docs: DatedFile[],
  code: DatedFile[],
  readme: DatedFile | undefined,
  config: ResolvedConfig,
): DimensionDraft {
  const primary = readme ?? pickMedian(docs);
  const codeLatest = code.reduce((best, item) => (item.whenMs > best.whenMs ? item : best));
  let lagDays = daysBetween(primary.whenMs, codeLatest.whenMs);
  if (Math.abs(lagDays) <= RUBRIC.freshness.mtimeSlackDays) lagDays = 0;
  const findings: Finding[] = [note(
    primary.file.path,
    'No embedded dates found. Freshness used file modification times, which a git checkout rewrites. Add Last updated: YYYY-MM-DD to the README and @modified YYYY-MM-DD on the main source file.',
    'freshness/no-embedded-dates',
    'note',
  )];
  let score: number = RUBRIC.freshness.mtimeFallbackScore;
  if (lagDays > config.staleDays) {
    score = roundScore(clamp(100 - (RUBRIC.freshness.lagScale * lagDays) / config.staleDays, RUBRIC.freshness.floor, 100));
    findings.push(staleFinding(primary, undefined, lagDays, config.staleDays));
  }
  return {
    id: 'freshness',
    score,
    findings,
    details: { lagDays, usedMtime: true, primary: primary.file.path, code: codeLatest.file.path },
  };
}
