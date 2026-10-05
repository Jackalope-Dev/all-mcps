import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cacheFileForRoute,
  isrRoutes,
  pruneIsrSeed,
  routeForCacheFile,
} from './prune-isr-seed.mjs';

const manifest = {
  routes: {
    '/': { initialRevalidateSeconds: 300 },
    '/mcp/github': { initialRevalidateSeconds: 3600, srcRoute: '/mcp/[id]' },
    '/about': { initialRevalidateSeconds: false },
    '/blog/hello': { initialRevalidateSeconds: false },
  },
};

let tmp;
afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

function touch(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{}');
}

describe('prune-isr-seed', () => {
  it('maps routes to cache files', () => {
    expect(cacheFileForRoute('/')).toBe('index.cache');
    expect(cacheFileForRoute('/mcp/github')).toBe('mcp/github.cache');
  });

  it('selects only routes with a numeric revalidate', () => {
    expect(isrRoutes(manifest)).toEqual(['/', '/mcp/github']);
  });

  it('removes ISR entries and leaves static pages and fetch cache alone', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-isr-'));
    const build = path.join(tmp, 'BUILD123');
    for (const f of [
      'index.cache',
      'mcp/github.cache',
      'about.cache',
      'blog/hello.cache',
    ]) {
      touch(path.join(build, f));
    }
    touch(path.join(tmp, '__fetch', 'BUILD123', 'abc'));

    const r = pruneIsrSeed({ manifest, cacheDir: tmp });

    expect(r).toMatchObject({ routes: 2, buildDirs: 1, removed: 2 });
    expect(fs.existsSync(path.join(build, 'index.cache'))).toBe(false);
    expect(fs.existsSync(path.join(build, 'mcp/github.cache'))).toBe(false);
    expect(fs.existsSync(path.join(build, 'about.cache'))).toBe(true);
    expect(fs.existsSync(path.join(build, 'blog/hello.cache'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, '__fetch', 'BUILD123', 'abc'))).toBe(
      true,
    );
  });

  it('maps both cache layouts back to page routes', () => {
    const sha = 'a'.repeat(64);
    expect(routeForCacheFile('index.cache')).toBe('/');
    expect(routeForCacheFile('mcp/github.cache')).toBe('/mcp/github');
    expect(routeForCacheFile(`route-cache/APP_PAGE/${sha}/$/index.cache`)).toBe(
      '/',
    );
    expect(
      routeForCacheFile(`route-cache/APP_PAGE/${sha}/$/best/google.cache`),
    ).toBe('/best/google');
    expect(
      routeForCacheFile(`route-cache/APP_PAGE/${sha}/$/index/index/x.cache`),
    ).toBe('/index/x');
    expect(routeForCacheFile('mcp/github.rsc')).toBeNull();
  });

  it('prunes the route-scoped layout that Next 16.3.8 / OpenNext 4.1 writes', () => {
    // Regression: the name-based lookup matched nothing in this layout, so
    // every deploy reseeded the live cache with build-time snapshot pages.
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-isr-'));
    const build = path.join(tmp, 'BUILD456');
    const home = `route-cache/APP_PAGE/${'b'.repeat(64)}/$/index.cache`;
    const mcp = `route-cache/APP_PAGE/${'c'.repeat(64)}/$/mcp/github.cache`;
    const about = `route-cache/APP_PAGE/${'d'.repeat(64)}/$/about.cache`;
    for (const f of [home, mcp, about]) touch(path.join(build, f));

    const r = pruneIsrSeed({ manifest, cacheDir: tmp });

    expect(r).toMatchObject({ routes: 2, removed: 2, missing: 0 });
    expect(fs.existsSync(path.join(build, home))).toBe(false);
    expect(fs.existsSync(path.join(build, mcp))).toBe(false);
    expect(fs.existsSync(path.join(build, about))).toBe(true);
  });
});
