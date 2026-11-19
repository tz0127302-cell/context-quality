function escapeProperty(value) {
    return value
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
        .replace(/:/g, '%3A')
        .replace(/,/g, '%2C');
}
function escapeMessage(value) {
    return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
export function renderAnnotations(report) {
    return report.findings.map((finding) => annotation(finding)).join('\n');
}
function annotation(finding) {
    const level = finding.severity === 'error' ? 'error' : finding.severity === 'warning' ? 'warning' : 'notice';
    const props = [
        finding.file ? `file=${escapeProperty(finding.file)}` : '',
        finding.line ? `line=${finding.line}` : '',
        `title=${escapeProperty(`cqs ${finding.ruleId}`)}`,
    ].filter(Boolean);
    return `::${level} ${props.join(',')}::${escapeMessage(finding.message)}`;
}
export function renderGithub(report) {
    const body = [
        renderAnnotations(report),
        `CQS_SCORE=${report.overall}`,
        `CQS_GRADE=${report.grade}`,
        `CQS_PASSED=${report.passed ? 'true' : 'false'}`,
    ].filter((line) => line.length > 0);
    return `${body.join('\n')}\n`;
}
//# sourceMappingURL=github.js.map