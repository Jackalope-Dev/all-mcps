import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviveDates, swrEdgeCache } from './edgeCache';

/** Fake global tier: the R2 bucket swrEdgeCache reads via the request env. */
const r2 = new Map<string, string>();
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: {
      NEXT_INC_CACHE_R2_BUCKET: {
        get: async (k: string) =>
          r2.has(k) ? { text: async () => r2.get(k) as string } : null,
        put: async (k: string, v: string) => {
          r2.set(k, v);
        },
      },
    },
    ctx: { waitUntil: () => {} },
  }),
}));

/** In-memory stand-in for the Workers Cache API (`caches.default`). */
function installFakeCache() {
  const store = new Map<string, string>();
  const fake = {
    match: async (url: string) =>
      store.has(url) ? new Response(store.get(url)) : undefined,
    put: async (url: string, res: Response) => {
      store.set(url, await res.text());
    },
  };
  (globalThis as { caches?: unknown }).caches = { default: fake };
  return store;
}

const OPTS = { freshMs: 60_000, maxAgeSeconds: 3600 };

describe('swrEdgeCache', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installFakeCache();
    r2.clear();
  });
  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches;
    vi.useRealTimers();
  });

  it('loads and stores on a miss, then serves a fresh copy without loading', async () => {
    const load = vi.fn(async () => [{ id: 'a' }]);
    expect(await swrEdgeCache('k', OPTS, load)).toEqual([{ id: 'a' }]);
    expect(await swrEdgeCache('k', OPTS, load)).toEqual([{ id: 'a' }]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never caches a null load (D1 missing or failed)', async () => {
    const load = vi.fn(async () => null);
    expect(await swrEdgeCache('k', OPTS, load)).toBeNull();
    expect(store.size).toBe(0);
    await swrEdgeCache('k', OPTS, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('serves a stale copy instead of waiting on the load', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
    await swrEdgeCache('k', OPTS, async () => ['old']);
    vi.setSystemTime(new Date('2026-10-15T00:10:00Z'));
    const load = vi.fn(async () => ['new']);
    expect(await swrEdgeCache('k', OPTS, load)).toEqual(['old']);
  });

  it('returns Date columns as Dates after a round trip', async () => {
    const createdAt = new Date('2026-09-01T12:00:00.000Z');
    await swrEdgeCache('k', OPTS, async () => [{ id: 'a', createdAt }]);
    const [row] =
      (await swrEdgeCache<{ id: string; createdAt: Date }[]>(
        'k',
        OPTS,
        async () => null,
      )) ?? [];
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.createdAt.getTime()).toBe(createdAt.getTime());
  });
});

describe('swrEdgeCache global tier', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installFakeCache();
    r2.clear();
  });
  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches;
  });

  it('writes a load to both the colo cache and R2', async () => {
    await swrEdgeCache('k', OPTS, async () => ['a']);
    expect(store.size).toBe(1);
    expect(r2.has('app-cache/k')).toBe(true);
  });

  it('serves a colo with no copy from R2 without loading, and seeds the colo', async () => {
    r2.set(
      'app-cache/k',
      JSON.stringify({ data: ['global'], timestamp: Date.now() }),
    );
    const load = vi.fn(async () => ['fresh']);
    expect(await swrEdgeCache('k', OPTS, load)).toEqual(['global']);
    expect(load).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
  });

  it('ignores an R2 copy past maxAgeSeconds', async () => {
    r2.set(
      'app-cache/k',
      JSON.stringify({ data: ['ancient'], timestamp: Date.now() - 7200_000 }),
    );
    expect(await swrEdgeCache('k', OPTS, async () => ['fresh'])).toEqual([
      'fresh',
    ]);
  });
});

describe('reviveDates', () => {
  it('only turns full ISO instants into Dates', () => {
    expect(reviveDates('', '2026-09-01T12:00:00Z')).toBeInstanceOf(Date);
    expect(reviveDates('', '2026-09-01')).toBe('2026-09-01');
    expect(reviveDates('', 'v2026-09-01T12:00:00Z')).toBe(
      'v2026-09-01T12:00:00Z',
    );
    expect(reviveDates('', 42)).toBe(42);
  });
});
