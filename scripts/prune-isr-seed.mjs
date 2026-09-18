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

/** Deletes the ISR entries from every build dir under cacheDir. Returns counts. */
export function pruneIsrSeed({ manifest, cacheDir }) {
  const routes = isrRoutes(manifest);
  let removed = 0;
  let missing = 0;
  const buildDirs = fs
    .readdirSync(cacheDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '__fetch')
    .map((d) => path.join(cacheDir, d.name));

  for (const dir of buildDirs) {
    for (const route of routes) {
      const file = path.join(dir, cacheFileForRoute(route));
      if (fs.existsSync(file)) {
        fs.rmSync(file);
        removed++;
      } else {
        missing++;
      }
    }
  }
  return {
    routes: routes.length,
    buildDirs: buildDirs.length,
    removed,
    missing,
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
