const DATE_RE = /(?:@modified|last\s+updated|updated|modified|date)\s*[:\s]\s*(\d{4}-\d{2}-\d{2})/gi;

export interface FoundDate {
  iso: string;
  utcMs: number;
}

function parseIsoDay(iso: string): FoundDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day);
  const check = new Date(utcMs);
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day
  ) {
    return undefined;
  }
  return { iso, utcMs };
}

/** Latest embedded calendar date in a file, if any. */
export function latestEmbeddedDate(content: string): FoundDate | undefined {
  DATE_RE.lastIndex = 0;
  let best: FoundDate | undefined;
  for (const match of content.matchAll(DATE_RE)) {
    const iso = match[1];
    if (!iso) continue;
    const found = parseIsoDay(iso);
    if (!found) continue;
    if (!best || found.utcMs > best.utcMs) best = found;
  }
  return best;
}

export function daysBetween(earlierMs: number, laterMs: number): number {
  return Math.round((laterMs - earlierMs) / 86_400_000);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1] ?? 0;
    const right = sorted[mid] ?? 0;
    return (left + right) / 2;
  }
  return sorted[mid] ?? 0;
}
