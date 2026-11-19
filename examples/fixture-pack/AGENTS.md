# Agent notes for tiny-retry

You are editing a tiny retry helper. Stay inside this pack.

## Task

Keep the public signature of `retry` stable. Backoff stays exponential from `baseMs`.

## Commands

```bash
npx tsc --noEmit --pretty false --target ES2022 --module nodenext src/index.ts
```

## Boundaries

- Do not add a dependency.
- Do not read or write environment files. Configuration belongs in arguments.
- Prefer `src/index.ts`, `src/options.ts`, and `src/types.ts` over the notes directory.
