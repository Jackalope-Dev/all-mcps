/**
 * Small JSON cache on the Workers Cache API (`caches.default`). Unlike a
 * module-level variable it is shared by every isolate in a colo, so an
 * expensive D1 aggregate or scan runs once per colo per TTL instead of once
 * per cold isolate. Best-effort: where the Cache API is missing (local dev,
 * tests, workers.dev) reads miss and writes are dropped.
 */

/** Keys live under the site's own origin; only Worker code can read them. */
const KEY_ORIGIN = 'https://allmcps.com/__internal/cache/';

function edgeCache(): Cache | null {
  const store = (globalThis as { caches?: { default?: Cache } }).caches;
  return store?.default ?? null;
}

function keyUrl(key: string): string {
  return KEY_ORIGIN + encodeURIComponent(key);
}

export async function readEdgeCache<T>(
  key: string,
  reviver?: (key: string, value: unknown) => unknown,
): Promise<T | null> {
  try {
    const hit = await edgeCache()?.match(keyUrl(key));
    return hit ? (JSON.parse(await hit.text(), reviver) as T) : null;
  } catch {
    return null;
  }
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** JSON.parse reviver: Drizzle timestamp columns come back as Dates, not strings. */
export function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_INSTANT.test(value)
    ? new Date(value)
    : value;
}

type SwrEntry<T> = { data: T; timestamp: number };

/** A background refresh not done by then may be retried (a canceled one never settles). */
const SWR_REFRESH_RETRY_MS = 60 * 1000;
const swrRefreshStartedAt = new Map<string, number>();

/**
 * Stale-while-revalidate on the edge cache, for D1 reads too slow to sit on a
 * render path. A copy younger than `freshMs` is returned as is; an older one
 * (kept up to `maxAgeSeconds`) is returned at once and reloaded in
 * waitUntil. Only a colo with no copy waits on `load`. `load` returns null
 * for "no usable data" (D1 missing or failed), which is never cached.
 */
export async function swrEdgeCache<T>(
  key: string,
  opts: { freshMs: number; maxAgeSeconds: number },
  load: () => Promise<T | null>,
): Promise<T | null> {
  const entry = await readEdgeCache<SwrEntry<T>>(key, reviveDates);
  if (entry) {
    if (Date.now() - entry.timestamp >= opts.freshMs) {
      void refreshInBackground(key, opts, load);
    }
    return entry.data;
  }
  return loadAndStore(key, opts, load);
}

async function loadAndStore<T>(
  key: string,
  opts: { maxAgeSeconds: number },
  load: () => Promise<T | null>,
): Promise<T | null> {
  const data = await load();
  if (data != null) {
    await writeEdgeCache(
      key,
      { data, timestamp: Date.now() } satisfies SwrEntry<T>,
      opts.maxAgeSeconds,
    );
  }
  return data;
}

async function refreshInBackground<T>(
  key: string,
  opts: { maxAgeSeconds: number },
  load: () => Promise<T | null>,
): Promise<void> {
  if (Date.now() - (swrRefreshStartedAt.get(key) ?? 0) < SWR_REFRESH_RETRY_MS) {
    return;
  }
  swrRefreshStartedAt.set(key, Date.now());
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(
      loadAndStore(key, opts, load).catch((err) => {
        console.error(`[edgeCache] background refresh of ${key} failed:`, err);
      }),
    );
  } catch {
    // No request context (build, tests): the stale copy stands until next time.
  }
}

export async function writeEdgeCache(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await edgeCache()?.put(
      keyUrl(key),
      new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${Math.max(1, Math.floor(ttlSeconds))}`,
        },
      }),
    );
  } catch {
    // Cache API unavailable: callers just recompute next time.
  }
}
