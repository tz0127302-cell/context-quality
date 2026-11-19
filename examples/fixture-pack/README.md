# tiny-retry context pack

Last updated: 2026-11-01

This folder is a context pack for a coding agent that needs to change retry behavior.
It is also the scored fixture for `cqs`: a realistic pack with a few deliberate defects.

## What this pack is for

`retry` runs an async operation a fixed number of times. The delay doubles after each failure.
Callers pass an optional attempts count and a base delay.

## API

### `retry(operation, options?)`

Runs `operation` until it resolves or the attempt budget is spent.
The thrown error from the final attempt is rethrown as-is.

```ts
import { retry } from './src/index.ts';

await retry(() => fetch('/health'), { attempts: 4, baseMs: 50 });
```

### `RetryOptions`

Defined in `src/types.ts`.

- `attempts` includes the first try. Default: 3.
- `baseMs` is the delay before the second try. Later tries double it. Default: 25.

## Layout

- `src/index.ts` is the entrypoint (`package.json` `main`).
- `src/options.ts` fills defaults.
- `src/util.ts` sleeps.
- `docs/guide.md` explains the backoff the agent should preserve.
