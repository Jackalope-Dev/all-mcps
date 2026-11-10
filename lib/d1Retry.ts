/**
 * One retry for a D1 read that failed on a transient error.
 *
 * D1 answers some requests with an error instead of a result while it is busy:
 * "D1 DB is overloaded", "Network connection lost", or an in-flight query cut
 * off when the database resets after "exceeded its CPU time limit". Those come
 * in bursts around the cron ticks (the :00 tick runs health, enrich, the stale
 * sweep and the ai-content batches together), and they made fresh /mcp/[id]
 * renders 500 and the paged exports 503 (Nov 2026). They clear within a
 * moment, so one retry after a short pause rides most of them out; a second
 * failure is thrown for the caller to degrade.
 */

const RETRY_DELAY_MS = 300;
const RETRY_JITTER_MS = 300;

function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  return cause ? `${err.message} (cause: ${errorMessage(cause)})` : err.message;
}

export async function withD1Retry<T>(
  label: string,
  run: () => Promise<T>,
  opts: { delayMs?: number } = {},
): Promise<T> {
  try {
    return await run();
  } catch (first) {
    // The first error is the one worth seeing in the logs: it names what D1
    // said, which the page's own error (message only) never did.
    console.warn(`[d1] ${label} failed, retrying once: ${errorMessage(first)}`);
    const delay =
      opts.delayMs ??
      RETRY_DELAY_MS + Math.floor(Math.random() * RETRY_JITTER_MS);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      return await run();
    } catch (second) {
      console.error(
        `[d1] ${label} failed again after a retry: ${errorMessage(second)}`,
      );
      throw second;
    }
  }
}
