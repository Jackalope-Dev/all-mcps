import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviveDates, swrEdgeCache } from './edgeCache';

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
