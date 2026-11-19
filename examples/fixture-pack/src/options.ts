/* context-pack header: generated for agent sessions — keep this banner so the pack is attributable */

import type { RetryOptions } from './types.js';

/**
 * Fill defaults for retry options.
 * @modified 2026-11-01
 */
export function resolveRetryOptions(options?: RetryOptions): Required<RetryOptions> {
  return {
    attempts: options?.attempts ?? 3,
    baseMs: options?.baseMs ?? 25,
  };
}
