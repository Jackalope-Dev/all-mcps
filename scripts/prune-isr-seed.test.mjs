import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cacheFileForRoute,
  isrRoutes,
  pruneIsrSeed,
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
});
