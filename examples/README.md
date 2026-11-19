# Examples

## `fixture-pack`

A small context pack for an imaginary `tiny-retry` helper. It is the pack CI scores.

Pinned result: **89 / 100 (good)**. The per-dimension numbers are in [`fixture-pack.expected.json`](fixture-pack.expected.json). Heuristics are deterministic, so that file is an equality check, not a loose band.

The pack is deliberately imperfect:

| Defect | Where | Rule |
| --- | --- | --- |
| Synthetic credential pattern | `.env` line 2 | `secrets/github-pat` |
| Live-style env file | `.env` | `secrets/dotenv-file` |
| Lockfile | `package-lock.json` | `relevance/lockfile` |
| Byte-identical copy | `notes/duplicate.ts` of `src/util.ts` | `relevance/duplicate` |
| Stale doc | `docs/legacy.md` (`2025-06-01` vs code `2026-11-01`) | `freshness/stale-doc` |
| Broken relative link | `docs/legacy.md` → `./missing.md` | `completeness/broken-ref` |
| Repeated banner comment | the TypeScript files | `tokens/boilerplate` |

`.env.example` uses placeholders and is not a finding. The value in `.env` is synthetic. `cqs` must flag the pattern and must not print it.

```bash
npm run demo
npm run cqs -- suggest examples/fixture-pack
```

Scoring the whole repository will also flag this fixture. That is the scanner doing its job. Point `cqs` at `src` when you want a score of the tool itself.
