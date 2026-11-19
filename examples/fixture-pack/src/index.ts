/* context-pack header: generated for agent sessions — keep this banner so the pack is attributable */

import { resolveRetryOptions } from './options.js';
import type { RetryOptions } from './types.js';
import { delay } from './util.js';

/**
 * Retry an async operation with capped exponential backoff.
 * @modified 2026-11-01
 */
export async function retry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const settings = resolveRetryOptions(options);
  let lastError: unknown;
  for (let attempt = 1; attempt <= settings.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === settings.attempts) break;
      await delay(settings.baseMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
