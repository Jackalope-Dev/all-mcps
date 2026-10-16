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
 * Global second tier for swrEdgeCache, under its own prefix in the ISR bucket
 * (app/api/cron/isr-cache-cleanup only deletes under `incremental-cache/`).
 * The Cache API is per colo and the site's traffic is spread thin, so most
 * ISR re-renders landed in a colo with no copy and ran the full D1 load
 * anyway (5-9s measured, past the 25s revalidation timeout when the crons
 * kept D1 busy). R2 is one copy for every colo.
 */
const SHARED_PREFIX = 'app-cache/';

async function sharedBucket(): Promise<R2Bucket | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    return (
      (env as { NEXT_INC_CACHE_R2_BUCKET?: R2Bucket })
        .NEXT_INC_CACHE_R2_BUCKET ?? null
    );
  } catch {
    return null;
  }
}

/** This colo's copy, else the global one (which then seeds this colo). */
async function readSwrEntry<T>(
  key: string,
  maxAgeSeconds: number,
): Promise<SwrEntry<T> | null> {
  const local = await readEdgeCache<SwrEntry<T>>(key, reviveDates);
  if (local) return local;
  try {
    const obj = await (await sharedBucket())?.get(SHARED_PREFIX + key);
    if (!obj) return null;
    const entry = JSON.parse(await obj.text(), reviveDates) as SwrEntry<T>;
    const ageSeconds = (Date.now() - entry.timestamp) / 1000;
    if (ageSeconds >= maxAgeSeconds) return null;
    await writeEdgeCache(key, entry, maxAgeSeconds - ageSeconds);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Stale-while-revalidate for D1 reads too slow to sit on a render path, kept
 * in this colo's edge cache and globally in R2. A copy younger than
 * `freshMs` is returned as is; an older one (kept up to `maxAgeSeconds`) is
 * returned at once and reloaded in waitUntil. Only a cold start with no copy
 * anywhere waits on `load`. `load` returns null for "no usable data" (D1
 * missing or failed), which is never cached.
 */
export async function swrEdgeCache<T>(
  key: string,
  opts: { freshMs: number; maxAgeSeconds: number },
  load: () => Promise<T | null>,
): Promise<T | null> {
  const entry = await readSwrEntry<T>(key, opts.maxAgeSeconds);
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
    const entry: SwrEntry<T> = { data, timestamp: Date.now() };
    await Promise.all([
      writeEdgeCache(key, entry, opts.maxAgeSeconds),
      sharedBucket()
        .then((b) => b?.put(SHARED_PREFIX + key, JSON.stringify(entry)))
        .catch(() => {
          // R2 unavailable: the colo copy still serves this colo.
        }),
    ]);
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
