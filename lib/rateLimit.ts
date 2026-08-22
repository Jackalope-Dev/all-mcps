/**
 * Best-effort, per-Worker-isolate rate limiting for public API routes.
 *
 * This is deliberately NOT backed by D1/KV: a write on every read-heavy GET
 * (search, categories, etc.) would add latency and load to endpoints whose
 * whole purpose is being cheap to call, and Cloudflare spins up many
 * concurrent isolates — a shared store would need its own consistency story
 * for a feature whose only job is "shed obvious abuse and tell well-behaved
 * callers how much headroom they have." An in-memory fixed-window counter
 * does both without new infra: it resets on redeploys/isolate recycling
 * (fail-open, never fail-closed) and undercounts across the full fleet
 * rather than overcounts, which is the safe direction for a public directory.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Crude memory bound — isolates are short-lived, so this rarely matters, but caps worst case. */
const MAX_TRACKED_KEYS = 5000;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets — also the right value for `Retry-After` on a 429. */
  resetSeconds: number;
};

/**
 * Fixed-window check for `key` (already scoped to a route + client). Mutates
 * the shared in-memory bucket map. Pure w.r.t. its inputs otherwise.
 */
export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, limit, remaining: limit - 1, resetSeconds: windowSeconds };
  }

  existing.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetSeconds,
  };
}

/** Standard draft-ietf-httpapi-ratelimit-headers style headers for a successful response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(result.resetSeconds),
  };
}

/** Best-effort caller identity for bucketing — Cloudflare's own edge IP header, when present. */
export function clientKey(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/** JSON 429 response for a request that failed `checkRateLimit`. */
export function rateLimitedResponse(result: RateLimitResult, extraHeaders?: Record<string, string>) {
  return Response.json(
    {
      error: 'rate_limited',
      message: `Too many requests. Retry after ${result.resetSeconds}s.`,
      docs: 'https://allmcps.com/docs/api',
    },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        'Retry-After': String(result.resetSeconds),
        ...extraHeaders,
      },
    }
  );
}
