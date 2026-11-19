#!/usr/bin/env bash
# Create or update a pull request comment that contains the cqs Markdown report.
# A missing token or a non-pull-request event skips the comment instead of failing the score.
set -euo pipefail

if [[ "${GITHUB_EVENT_NAME:-}" != "pull_request" ]]; then
  echo "Not a pull request event; skipping the context-quality comment."
  exit 0
fi

if [[ -z "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]]; then
  echo "No token available; skipping the context-quality comment."
  exit 0
fi

export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN}}"
report_path="${REPORT_PATH:-cqs-report.md}"

if [[ ! -f "$report_path" ]]; then
  echo "Report not found at ${report_path}; skipping the comment."
  exit 0
fi

if ! command -v gh >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "gh and jq are required to comment; skipping."
  exit 0
fi

marker="<!-- cqs-report -->"
body_file="$(mktemp)"
{
  printf '%s\n\n' "$marker"
  cat "$report_path"
} > "$body_file"

# GitHub issue comments cap out at 65536 characters.
if [[ "$(wc -c < "$body_file")" -gt 65000 ]]; then
  head -c 64000 "$body_file" > "${body_file}.trim"
  printf '\n\n_Report truncated._\n' >> "${body_file}.trim"
  mv "${body_file}.trim" "$body_file"
fi

repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
pr_number="$(jq -r '.pull_request.number' "$GITHUB_EVENT_PATH")"
payload="$(jq -n --rawfile body "$body_file" '{body: $body}')"

existing="$(gh api --paginate "repos/${repo}/issues/${pr_number}/comments" \
  --jq ".[] | select(.body | contains(\"${marker}\")) | .id" | head -n 1 || true)"

if [[ -n "${existing}" ]]; then
  if ! printf '%s' "$payload" | gh api --method PATCH "repos/${repo}/issues/comments/${existing}" --input - >/dev/null; then
    echo "Unable to update the pull request comment. The report file is still on disk." >&2
    exit 0
  fi
  echo "Updated comment ${existing}"
else
  if ! printf '%s' "$payload" | gh api --method POST "repos/${repo}/issues/${pr_number}/comments" --input - >/dev/null; then
    echo "Unable to post the pull request comment. The report file is still on disk." >&2
    exit 0
  fi
  echo "Posted a context-quality comment"
fi
