/**
 * One retry for a D1 read that failed on a transient error.
 *
 * At the cron ticks D1 answers reads with "D1 DB is overloaded. Too many
 * resources consumed within a 10 second window" (also seen: "Network
 * connection lost"), and that made fresh /mcp/[id] renders 500 and the paged
 * exports 503 (Nov 2026). The limit is over a 10 s window, so a retry a few
 * hundred ms later lands in the same window and fails the same way (seen in
 * production): the one retry waits 1.5-3 s. A second failure is thrown for
 * the caller to degrade.
 */

const RETRY_DELAY_MS = 1500;
const RETRY_JITTER_MS = 1500;

/** The innermost cause: Drizzle wraps D1's error in "Failed query: <the whole SQL>". */
function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  return cause ? errorMessage(cause) : err.message.slice(0, 300);
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
