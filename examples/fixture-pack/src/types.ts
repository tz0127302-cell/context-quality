/* context-pack header: generated for agent sessions — keep this banner so the pack is attributable */

/**
 * Options for retry.
 * @modified 2026-11-01
 */
export interface RetryOptions {
  /** Total attempts, including the first try. */
  attempts?: number;
  /** Delay before the second attempt, in milliseconds. Later attempts double it. */
  baseMs?: number;
}
