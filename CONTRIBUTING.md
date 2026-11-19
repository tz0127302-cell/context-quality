# Contributing

`cqs` is a small, offline scorer. Changes should stay deterministic: the same pack scores the same on every machine, with no network and no model.

## Setup

Node.js 20 or newer.

```bash
npm install
npm test
npm run typecheck
npm run build
node dist/cli.js score examples/fixture-pack
```

`npm test` runs the TypeScript tests with `node:test`. It does not need a prior build. `npm run build` emits `dist/`, which the GitHub Action runs. CI fails if `dist/` drifts from the source.

## Changing a score

The numbers live in `src/rubric.ts`. The README rubric table should match them.

When you change a dimension:

1. Update the rubric constant and the dimension function together.
2. Update or add a unit test that locks the new number from the outside. Do not import the constant just to echo it back.
3. If `examples/fixture-pack` moves, update `examples/fixture-pack.expected.json` and the score quoted in the README.
4. Say in the pull request why the new number is a better signal, not only that it changed.

Freshness compares dates inside the pack. Do not compare documents to `Date.now()`. A git checkout rewrites file mtimes, and a fixture that depends on today's date will rot.

## Secrets

The scanner flags patterns and must never print the matched value. Tests walk the JSON, Markdown, SARIF, and annotation output to prove that.

`examples/fixture-pack/.env` contains a synthetic token shaped like a GitHub personal access token. It is not a credential. Do not replace it with a real one, and do not paste live credentials into issues or pull requests.

## Commits

Use [conventional commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

Keep pull requests focused. A scoring change and a drive-by rewrite of the CLI are two reviews.
