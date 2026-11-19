/* context-pack header: generated for agent sessions — keep this banner so the pack is attributable */

/**
 * Sleep for a number of milliseconds.
 * @modified 2026-11-01
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
