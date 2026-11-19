#!/usr/bin/env bash
# Run the offline cqs CLI inside a composite GitHub Action.
# Scoring does not call a network API. npm ci runs only if dist/cli.js is missing.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "cqs requires Node.js 20 or newer, and node was not on PATH." >&2
  exit 3
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$node_major" -lt 20 ]]; then
  echo "cqs requires Node.js 20 or newer. Found $(node -v)." >&2
  exit 3
fi

cli="${ACTION_PATH}/dist/cli.js"
if [[ ! -f "$cli" ]]; then
  echo "dist/cli.js is missing. Building cqs from ${ACTION_PATH}." >&2
  npm ci --prefix "$ACTION_PATH"
  npm run build --prefix "$ACTION_PATH"
fi

args=(score "${INPUT_PATH:-.}" --format github --threshold "${INPUT_THRESHOLD:-0}")

if [[ -n "${INPUT_CONFIG:-}" ]]; then
  args+=(--config "$INPUT_CONFIG")
fi
if [[ -n "${INPUT_MARKDOWN:-}" ]]; then
  args+=(--markdown-out "$INPUT_MARKDOWN")
fi
if [[ -n "${INPUT_SARIF:-}" ]]; then
  args+=(--sarif-out "$INPUT_SARIF")
fi
if [[ "${INPUT_FAIL_ON_SECRETS:-false}" == "true" ]]; then
  args+=(--fail-on-secrets)
fi
if [[ -n "${INPUT_IGNORE:-}" ]]; then
  while IFS= read -r glob; do
    glob="${glob#"${glob%%[![:space:]]*}"}"
    glob="${glob%"${glob##*[![:space:]]}"}"
    [[ -z "$glob" ]] && continue
    args+=(--ignore "$glob")
  done <<< "$INPUT_IGNORE"
fi

node "$cli" "${args[@]}"
