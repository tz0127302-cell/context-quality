/**
 * Credential-shaped patterns. Callers must never persist the matched text.
 * Generic assignments are intentionally not included here so prose can say "api key".
 */
const CREDENTIAL_RES = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAIza[0-9A-Za-z\-_]{35}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/,
];

export function containsCredentialPattern(text: string): boolean {
  return CREDENTIAL_RES.some((re) => re.test(text));
}

export function isPlaceholderSecret(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return true;
  if (/^(?:x{3,}|changeme|change[-_]?me|todo|placeholder|example|xxx+|none|null|undefined|test|fake|dummy|sample|redacted|password|secret|n\/a)$/i.test(v)) {
    return true;
  }
  if (/^<[^>]+>$/.test(v) || /^\$\{[^}]+\}$/.test(v)) return true;
  if (/your[-_\s]?/i.test(v) && v.length < 48) return true;
  if (/example/i.test(v) || /placeholder/i.test(v)) return true;
  if (v.includes('process.env') || v.includes('os.environ') || v.includes('os.getenv')) return true;
  return false;
}
