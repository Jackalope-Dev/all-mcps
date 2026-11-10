import { swrEdgeCache } from './edgeCache';
import { servableSql } from './servability';

/**
 * The one listing count shown anywhere on the site: homepage, /pricing,
 * /advertise, /trust, /state-of-mcp (and its OG image), /categories, the
 * config generator, llms.txt, llms-full.txt and data.json.
 *
 * It counts servable listings (lib/servability.ts: active and not flagged by
 * the stale sweep), the same set browse, search and the exports serve.
 * Archived repos are deliberately still in it: servability keeps them (they
 * often still ship a working package) and ranks them lower instead.
 *
 * Before this, each surface counted its own way (active rows cached 24h, a 6h
 * ecosystem scan, a sum of category counts, the length of an export that fell
 * back to the 114-row snapshot, a hardcoded "30,000+"), so the same visitor
 * could read four different totals.
 */
export type CatalogCount = {
  count: number;
  /** ISO instant the count was taken. */
  asOf: string;
};

/** A count this old is served as is while a fresh one loads in waitUntil. */
const FRESH_MS = 15 * 60 * 1000;
/** Kept this long (stale) so a D1 blip never blanks the number. */
const MAX_AGE_SECONDS = 24 * 60 * 60;
// Bump the version when the definition changes, so a deploy can't serve a
// count taken under the old rule.
const CACHE_KEY = 'catalog-count/v1';

let memo: { value: CatalogCount; at: number } | null = null;
let inflight: Promise<CatalogCount | null> | null = null;

type CountDb = {
  prepare(query: string): { first(): Promise<unknown> };
};

/** The servable count straight from D1, or null when D1 is missing or fails. */
export async function queryCatalogCount(
  db: CountDb,
): Promise<CatalogCount | null> {
  try {
    const row = (await db
      .prepare(`SELECT count(*) AS n FROM servers WHERE ${servableSql()}`)
      .first()) as { n?: number } | null;
    const count = Number(row?.n ?? 0);
    // Zero means a cold or broken database, never a real catalog: don't cache it.
    if (!(count > 0)) return null;
    return { count, asOf: new Date().toISOString() };
  } catch (err) {
    console.error('[catalogCount] count query failed:', err);
    return null;
  }
}

async function loadCatalogCount(): Promise<CatalogCount | null> {
  let db: CountDb | undefined;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    db = (await getCloudflareContext()).env?.DB as CountDb | undefined;
  } catch {
    return null; // build time / tests without bindings
  }
  return db ? queryCatalogCount(db) : null;
}

/**
 * The cached servable count, or null when no count has ever loaded (build
 * time, D1 down on a cold start). Callers show a count-free phrase then,
 * never a guessed or bundled-snapshot number.
 */
export async function getCatalogCount(): Promise<CatalogCount | null> {
  if (memo && Date.now() - memo.at < FRESH_MS) return memo.value;
  inflight ??= swrEdgeCache<CatalogCount>(
    CACHE_KEY,
    { freshMs: FRESH_MS, maxAgeSeconds: MAX_AGE_SECONDS },
    loadCatalogCount,
  )
    .then((value) => {
      if (value) memo = { value, at: Date.now() };
      return value ?? memo?.value ?? null;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** "Nov 10, 2026, 22:15 UTC" — for "as of" notes next to the count. */
export function formatCatalogAsOf(c: CatalogCount): string {
  const d = new Date(c.asOf);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })} UTC`;
}

/** Test hook: forget the per-isolate copy. */
export function resetCatalogCountMemo(): void {
  memo = null;
  inflight = null;
}
