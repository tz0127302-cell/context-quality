import { isUnsafeDotenv } from '../classify.js';
import { isPlaceholderSecret } from '../credentials.js';
import { RUBRIC } from '../rubric.js';
import { roundScore } from '../util.js';
const SPECIFIC = [
    {
        ruleId: 'secrets/aws-access-key',
        message: 'Possible AWS access key id. Value redacted.',
        re: /\bAKIA[0-9A-Z]{16}\b/,
    },
    {
        ruleId: 'secrets/github-pat',
        message: 'Possible GitHub personal access token. Value redacted.',
        re: /\bghp_[A-Za-z0-9]{36}\b/,
    },
    {
        ruleId: 'secrets/github-fine-grained',
        message: 'Possible GitHub fine-grained token. Value redacted.',
        re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/,
    },
    {
        ruleId: 'secrets/slack-token',
        message: 'Possible Slack token. Value redacted.',
        re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    },
    {
        ruleId: 'secrets/google-api-key',
        message: 'Possible Google API key. Value redacted.',
        re: /\bAIza[0-9A-Za-z\-_]{35}\b/,
    },
    {
        ruleId: 'secrets/openai-key',
        message: 'Possible OpenAI-style API key. Value redacted.',
        re: /\bsk-[A-Za-z0-9]{20,}\b/,
    },
    {
        ruleId: 'secrets/private-key',
        message: 'Possible private key block. Value redacted.',
        re: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/,
    },
];
const ASSIGN_RE = /\b([A-Za-z0-9_.-]*(?:api[_-]?key|api[_-]?secret|secret|token|password|passwd|access[_-]?key|auth[_-]?token|private[_-]?key))\b\s*[:=]\s*(['"]?)([^\s'"#]{8,})\2/gi;
const CREDENTIAL_KEY = /^(?:password|passwd|api[_-]?key|api[_-]?secret|access[_-]?key|private[_-]?key|auth[_-]?token)$/i;
function looksLikeCode(value) {
    return /[()[\]{}<>?:]|=>|\.\w/.test(value);
}
function keyIsCredentialAssignment(key, envFile) {
    const name = key.split('.').pop() ?? key;
    if (CREDENTIAL_KEY.test(name))
        return true;
    if (envFile && /secret|token|password|key/i.test(name))
        return true;
    if (/[_-]/.test(name))
        return true;
    return name === name.toUpperCase() && /[A-Z]/.test(name);
}
function hasGenericLeak(line, filePath) {
    const envFile = isUnsafeDotenv(filePath);
    ASSIGN_RE.lastIndex = 0;
    for (const match of line.matchAll(ASSIGN_RE)) {
        const key = match[1] ?? '';
        const value = match[3] ?? '';
        if (isPlaceholderSecret(value) || looksLikeCode(value))
            continue;
        if (!keyIsCredentialAssignment(key, envFile))
            continue;
        return true;
    }
    return false;
}
export function scoreSecrets(files) {
    const findings = [];
    for (const file of files) {
        if (isUnsafeDotenv(file.path)) {
            findings.push({
                ruleId: 'secrets/dotenv-file',
                dimension: 'secrets',
                severity: 'warning',
                file: file.path,
                line: 1,
                message: 'Environment file included in the context pack. Prefer a .env.example with placeholders, and keep real values out of agent context.',
            });
        }
        if (file.binary || file.oversized || file.unreadable || file.content.length === 0)
            continue;
        const lines = file.content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i] ?? '';
            const specific = SPECIFIC.find((pattern) => pattern.re.test(line));
            if (specific) {
                findings.push({
                    ruleId: specific.ruleId,
                    dimension: 'secrets',
                    severity: 'error',
                    file: file.path,
                    line: i + 1,
                    message: specific.message,
                });
                continue;
            }
            if (hasGenericLeak(line, file.path)) {
                findings.push({
                    ruleId: 'secrets/generic-assignment',
                    dimension: 'secrets',
                    severity: 'error',
                    file: file.path,
                    line: i + 1,
                    message: 'Possible credential assignment. Value redacted.',
                });
            }
        }
    }
    let deduct = 0;
    for (const finding of findings) {
        deduct += finding.ruleId === 'secrets/dotenv-file'
            ? RUBRIC.secrets.dotenvPenalty
            : RUBRIC.secrets.patternPenalty;
    }
    return {
        id: 'secrets',
        score: roundScore(100 - deduct),
        findings,
        details: { findings: findings.length },
    };
}
//# sourceMappingURL=secrets.js.map