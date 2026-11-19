# Using retry

Last updated: 2026-10-15

The helper is intentionally small. Start at [`src/index.ts`](../src/index.ts).
Defaults live in [`src/options.ts`](../src/options.ts).

Backoff is `baseMs * 2 ** (attempt - 1)` and it is not jittered.
If you add jitter, document it in the README API section and bump the `Last updated` line.

The pack root README is [`../README.md`](../README.md).
