import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs between `opennextjs-cloudflare build` and `opennextjs-cloudflare deploy`.
 *
 * The build copies every page prerendered by `next build` into
 * .open-next/cache/<buildId>/, and deploy uploads those into the R2 ISR cache
 * under the new build id. But `next build` has no live D1 binding, so the ISR
 * pages were rendered from the bundled data/mcp-servers.json snapshot — the
 * homepage said "114 servers" after every deploy until its revalidate window
 * ran out and a second visitor came along (longer for the 1h /best, /mcp/[id]
 * and /categories pages).
 *
 * Deleting just the ISR entries (routes with a numeric revalidate in
 * .next/prerender-manifest.json) turns the first post-deploy request into a
 * cache miss, which renders against live D1 and caches that instead. Only ISR
 * routes are touched: they already re-render at runtime on every revalidate,
 * so they're known to work there. Fully static pages keep their seeded copy.
 *
 * Deliberately never fails the deploy — worst case it prints a warning and the
 * old behavior (stale seed that self-heals on revalidate) applies.
 */

/** Cache-file path (relative to a build dir) for a prerendered route. */
export function cacheFileForRoute(route) {
  return route === '/' ? 'index.cache' : `${route.replace(/^\//, '')}.cache`;
}

/** Routes whose prerender has a numeric revalidate (ISR), per the manifest. */
export function isrRoutes(manifest) {
  return Object.entries(manifest?.routes ?? {})
    .filter(([, r]) => typeof r?.initialRevalidateSeconds === 'number')
    .map(([route]) => route);
}

/**
 * Route-scoped cache file written by @opennextjs/aws >= 4.1 for Next.js 16.3.8+:
 * `route-cache/<KIND>/<sha256 of the owning route>/$/<normalized page path>.cache`.
 */
const ROUTE_CACHE_FILE =
  /^route-cache\/(?:PAGES|APP_PAGE|APP_ROUTE)\/[0-9a-f]{64}\/\$\/(.+)\.cache$/;

/** Inverse of Next's normalizePagePath: `/index` -> `/`, `/index/x` -> `/x`. */
function denormalizePagePath(page) {
  return /^\/index(\/|$)/.test(page)
    ? page.slice('/index'.length) || '/'
    : page;
}

/**
 * The page route a cache file (path relative to its build dir, `/`-separated)
 * holds, for both layouts: the legacy `<route>.cache` (`index.cache` is `/`)
 * and the route-scoped one above. Null for anything that isn't a page entry.
 */
export function routeForCacheFile(relPath) {
  const scoped = relPath.match(ROUTE_CACHE_FILE);
  if (scoped) return denormalizePagePath(`/${scoped[1]}`);
  if (relPath.startsWith('route-cache/') || !relPath.endsWith('.cache')) {
    return null;
  }
  const route = relPath.slice(0, -'.cache'.length);
  return route === 'index' ? '/' : `/${route}`;
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return listFiles(full, base);
    return [path.relative(base, full).split(path.sep).join('/')];
  });
}

/**
 * Deletes the ISR entries from every build dir under cacheDir. Returns counts.
 *
 * Walks the files rather than computing expected names: OpenNext's on-disk
 * layout changed with the Next 16.3.8 upgrade (route-scoped keys), and the
 * old name-based lookup then silently matched nothing, so every deploy seeded
 * the live cache with build-time snapshot pages again (homepage: "114 servers").
 */
export function pruneIsrSeed({ manifest, cacheDir }) {
  const routes = new Set(isrRoutes(manifest));
  const pruned = new Set();
  let removed = 0;
  const buildDirs = fs
    .readdirSync(cacheDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '__fetch')
    .map((d) => path.join(cacheDir, d.name));
  for (const dir of buildDirs) {
    for (const rel of listFiles(dir)) {
      const route = routeForCacheFile(rel);
      if (route === null || !routes.has(route)) continue;
      fs.rmSync(path.join(dir, rel));
      pruned.add(route);
      removed++;
    }
  }
  return {
    routes: routes.size,
    buildDirs: buildDirs.length,
    removed,
    missing: routes.size - pruned.size,
  };
}

function main() {
  const root = process.cwd();
  const manifestFile = path.join(root, '.next', 'prerender-manifest.json');
  const cacheDir = path.join(root, '.open-next', 'cache');

  if (!fs.existsSync(manifestFile) || !fs.existsSync(cacheDir)) {
    console.warn(
      `[prune-isr-seed] WARNING: ${fs.existsSync(manifestFile) ? cacheDir : manifestFile} not found — run after \`opennextjs-cloudflare build\`. Skipping; ISR pages will deploy with build-time snapshot data.`,
    );
    return;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const r = pruneIsrSeed({ manifest, cacheDir });
    console.log(
      `[prune-isr-seed] Removed ${r.removed} build-time ISR cache entries (${r.routes} ISR routes, ${r.buildDirs} build dir(s), ${r.missing} not present). They render from live D1 on first request.`,
    );
    if (r.routes > 0 && r.removed === 0) {
      console.warn(
        '[prune-isr-seed] WARNING: matched no cache files — the .open-next/cache layout may have changed.',
      );
    }
  } catch (e) {
    console.warn(`[prune-isr-seed] WARNING: skipped (${e.message}).`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
