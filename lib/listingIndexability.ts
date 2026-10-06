/**
 * Single source of truth for whether a /mcp/[id] listing is offered to search
 * engines. Used by the page's robots meta AND the listings sitemap so we never
 * submit a URL the page itself noindexes.
 *
 * Why this bar: Search Console showed ~6.5k listing pages in "Crawled -
 * currently not indexed" by mid-Sept 2026 (then a site-wide drop after the
 * Sept 2026 spam update). A listing without our own writeup only shows a README
 * excerpt — duplicate content Google already has from GitHub — so it's never
 * indexable. A writeup alone is templated-catalog shaped; requiring a second,
 * independent signal (real-world traction or a parsed/introspected tool list)
 * keeps the indexed set to listings people actually look for.
 *
 * Fully self-healing: once the enrich cron writes a writeup, or a listing
 * crosses the traction bar, it becomes indexable and enters the sitemap with
 * no manual step.
 */
export const INDEXABLE_MIN_GITHUB_STARS = 25;
export const INDEXABLE_MIN_NPM_DOWNLOADS = 100;

export type IndexabilityInput = {
  status?: string | null;
  hasAiDoc: boolean;
  hasTools: boolean;
  githubStars?: number | null;
  npmDownloads?: number | null;
};

export function isListingIndexable(s: IndexabilityInput): boolean {
  if (s.status && s.status !== 'active') return false;
  if (!s.hasAiDoc) return false;
  const hasTraction =
    (s.githubStars ?? 0) >= INDEXABLE_MIN_GITHUB_STARS ||
    (s.npmDownloads ?? 0) >= INDEXABLE_MIN_NPM_DOWNLOADS;
  return hasTraction || s.hasTools;
}
