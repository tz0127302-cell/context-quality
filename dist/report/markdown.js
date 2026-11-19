import { formatBytes, formatPercent } from '../util.js';
function location(file, line) {
    if (!file)
        return '';
    return line ? `\`${file}:${line}\`` : `\`${file}\``;
}
export function renderMarkdown(report) {
    const result = report.passed ? 'pass' : 'fail';
    const lines = [];
    lines.push('# Context quality report');
    lines.push('');
    lines.push(`**Overall: ${report.overall} / 100** (${report.grade})`);
    lines.push('');
    lines.push('| | |');
    lines.push('| --- | --- |');
    lines.push(`| Root | \`${report.root}\` |`);
    lines.push(`| Kind | ${report.kind} |`);
    lines.push(`| Files | ${report.filesScanned} |`);
    lines.push(`| Estimated tokens | ${report.tokensEstimated.toLocaleString('en-US')} |`);
    lines.push(`| Size | ${formatBytes(report.bytes)} |`);
    lines.push(`| Threshold | ${report.threshold} (${result}) |`);
    lines.push('');
    lines.push('## Dimensions');
    lines.push('');
    lines.push('| Dimension | Score | Weight |');
    lines.push('| --- | ---: | ---: |');
    for (const dimension of report.dimensions) {
        lines.push(`| ${dimension.label} | ${dimension.score} | ${formatPercent(dimension.weight)} |`);
    }
    lines.push('');
    lines.push('## Findings');
    lines.push('');
    if (report.findings.length === 0) {
        lines.push('No findings. The heuristic checks are clean.');
    }
    else {
        lines.push('| Severity | Rule | Location | Message |');
        lines.push('| --- | --- | --- | --- |');
        for (const finding of report.findings) {
            const where = location(finding.file, finding.line);
            const message = finding.message.replace(/\|/g, '\\|');
            lines.push(`| ${finding.severity} | \`${finding.ruleId}\` | ${where} | ${message} |`);
        }
    }
    lines.push('');
    lines.push('## Suggestions');
    lines.push('');
    if (report.suggestions.length === 0) {
        lines.push('No concrete edits.');
    }
    else {
        for (const suggestion of report.suggestions) {
            lines.push(`${suggestion.rank}. **+${suggestion.estimatedGain} overall** — ${suggestion.title}`);
            lines.push('');
            lines.push(`   ${suggestion.detail}`);
            lines.push('');
        }
    }
    if (report.llm.notes.length > 0) {
        lines.push('## Notes');
        lines.push('');
        for (const note of report.llm.notes)
            lines.push(`- ${note}`);
        lines.push('');
    }
    lines.push('Heuristic score from context-quality (`cqs`). Unofficial and offline. Not an Atlassian product.');
    lines.push('');
    return lines.join('\n');
}
export function renderSuggestions(report, limit = 20) {
    const lines = [];
    lines.push(`Context quality: ${report.overall}/100 (${report.grade})`);
    lines.push('');
    const items = report.suggestions.slice(0, limit);
    if (items.length === 0) {
        lines.push('No concrete edits. The heuristic checks are clean.');
        return `${lines.join('\n')}\n`;
    }
    lines.push('Ranked edits:');
    lines.push('');
    for (const item of items) {
        lines.push(`${item.rank}. +${item.estimatedGain} overall  ${item.dimension}`);
        lines.push(`   ${item.title}`);
        lines.push(`   ${item.detail}`);
        if (item.files.length > 0)
            lines.push(`   files: ${item.files.join(', ')}`);
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=markdown.js.map