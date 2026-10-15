/**
 * Single source of truth for whether a /mcp/[id] listing is offered to search
 * engines. Used by the page's robots meta AND the listings sitemap so we never
 * submit a URL the page itself noindexes.
 *
 * Why this bar: Search Console showed ~6.5k listing pages in "Crawled -
 * currently not indexed" by mid-Sept 2026 (then a site-wide drop after the
 * Sept 2026 spam update). A listing without our own writeup only shows a README
 * excerpt — duplicate content Google already has from GitHub — so it's never
 * indexable. A writeup alone is templated-catalog shaped, and once the
 * ai-content cron had written ~21.8k of them, "writeup plus any one signal"
 * still left ~7.5k listings indexable (Oct 2026). So a listing now needs BOTH
 * independent signals — real-world traction and proof the server runs — unless
 * its traction alone is strong enough that people clearly search for it
 * (~1.7k listings).
 *
 * "Proof it runs" means we saw it work: a live tools/list (toolsSource
 * 'introspected'), a sandbox run that started and asked for keys
 * (installNeedsConfig), or a healthy remote endpoint. A tool list parsed from
 * the README used to count, but that is the README's claim, not evidence —
 * and it let thin listings in on documentation alone.
 *
 * Fully self-healing: once the enrich cron writes a writeup, or a listing
 * crosses the traction bar, it becomes indexable and enters the sitemap with
 * no manual step.
 */
export const INDEXABLE_MIN_GITHUB_STARS = 25;
export const INDEXABLE_MIN_NPM_DOWNLOADS = 100;
/** Traction high enough to index without a verified run. */
export const INDEXABLE_STRONG_GITHUB_STARS = 250;
export const INDEXABLE_STRONG_NPM_DOWNLOADS = 5000;

export type IndexabilityInput = {
  status?: string | null;
  hasAiDoc: boolean;
  toolsSource?: string | null;
  installNeedsConfig?: Date | string | number | null;
  remoteEndpointHealthy?: boolean | number | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
  /** Flagged by the stale sweep (lib/staleness.ts). Noindexed during the grace period, before any removal. */
  staleFlagged?: boolean;
};

export function isListingIndexable(s: IndexabilityInput): boolean {
  if (s.status && s.status !== 'active') return false;
  if (s.staleFlagged) return false;
  if (!s.hasAiDoc) return false;
  const stars = s.githubStars ?? 0;
  const downloads = s.npmDownloads ?? 0;
  const hasTraction =
    stars >= INDEXABLE_MIN_GITHUB_STARS ||
    downloads >= INDEXABLE_MIN_NPM_DOWNLOADS;
  const hasStrongTraction =
    stars >= INDEXABLE_STRONG_GITHUB_STARS ||
    downloads >= INDEXABLE_STRONG_NPM_DOWNLOADS;
  return hasStrongTraction || (hasTraction && hasVerifiedRun(s));
}

/** We saw the server work: live tools, a sandbox start that asked for keys, or a healthy remote endpoint. */
function hasVerifiedRun(s: {
  toolsSource?: string | null;
  installNeedsConfig?: Date | string | number | null;
  remoteEndpointHealthy?: boolean | number | null;
}): boolean {
  return (
    s.toolsSource === 'introspected' ||
    s.installNeedsConfig != null ||
    Boolean(s.remoteEndpointHealthy)
  );
}
