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

export async function readEdgeCache<T>(key: string): Promise<T | null> {
  try {
    const hit = await edgeCache()?.match(keyUrl(key));
    return hit ? ((await hit.json()) as T) : null;
  } catch {
    return null;
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
