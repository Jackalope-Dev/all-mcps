import { computeQualityScore } from './qualityScore';
import { engagementScore } from './search';
import type { Server } from './servers';

/** Health states that mean the project is dead — never worth a first impression. */
const DEAD_HEALTH = new Set(['archived', 'offline']);

/**
 * The protocol's reference servers (Fetch, Memory, Filesystem, Time, ...) live
 * in the modelcontextprotocol/servers monorepo. They are demos of the protocol,
 * not products, but each listing inherits the whole monorepo's ~90k stars and
 * npm downloads, so they swept the homepage ahead of real vendor servers.
 */
const REFERENCE_SERVER_URL =
  /github\.com\/modelcontextprotocol\/servers(-archived)?(\/|$)/i;

function isReferenceServer(s: Pick<Server, 'url'>): boolean {
  return REFERENCE_SERVER_URL.test(s.url || '');
}

/**
 * Whether a listing is presentable on the homepage: it has a logo, a real
 * description and at least one tool, isn't a dead/archived project, and isn't
 * a protocol reference server.
 */
export function isShowcaseEligible(s: Server): boolean {
  if (!s.logoUrl?.trim()) return false;
  if ((s.description || '').trim().length < 30) return false;
  if (s.healthStatus && DEAD_HEALTH.has(s.healthStatus)) return false;
  if (!s.tools?.length) return false;
  if (isReferenceServer(s)) return false;
  return true;
}

/**
 * Homepage showcase score: listing quality (health, docs, install confidence,
 * community signal — 0–100) blended with adoption/engagement (stars, npm
 * downloads, upvotes, installs, views). Recency plays no part, so the first
 * impression is proven, working servers rather than whatever was imported last.
 */
function showcaseScore(s: Server): number {
  const quality = computeQualityScore(s).score;
  const verified = s.isVerifiedActive || s.healthStatus === 'healthy' ? 10 : 0;
  const official = s.isOfficial ? 10 : 0;
  return quality + engagementScore(s) * 2 + verified + official;
}

/**
 * GitHub owner/repo a listing lives in, lowercased, or the listing id when the
 * URL isn't a GitHub repo. Listings from one monorepo share its stars and
 * downloads, so without this one repo can fill several cards.
 */
function repoKey(s: Server): string {
  const m = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(s.url || '');
  return m ? `${m[1]}/${m[2].replace(/\.git$/i, '')}`.toLowerCase() : s.id;
}

/** Filter to presentable listings and rank them best-first, one per repo. */
export function rankShowcaseServers(
  servers: Server[],
  limit: number,
): Server[] {
  const seenRepos = new Set<string>();
  return servers
    .filter(isShowcaseEligible)
    .map((s) => ({ s, score: showcaseScore(s) }))
    .sort((a, b) => b.score - a.score)
    .filter(({ s }) => {
      const key = repoKey(s);
      if (seenRepos.has(key)) return false;
      seenRepos.add(key);
      return true;
    })
    .slice(0, limit)
    .map((x) => x.s);
}
