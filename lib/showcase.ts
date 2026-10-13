import { computeQualityScore } from './qualityScore';
import { engagementScore } from './search';
import type { Server } from './servers';

/** Health states that mean the project is dead — never worth a first impression. */
const DEAD_HEALTH = new Set(['archived', 'offline']);

/**
 * Whether a listing is presentable on the homepage: it has a logo, a real
 * description, and isn't a dead/archived project.
 */
export function isShowcaseEligible(s: Server): boolean {
  if (!s.logoUrl?.trim()) return false;
  if ((s.description || '').trim().length < 30) return false;
  if (s.healthStatus && DEAD_HEALTH.has(s.healthStatus)) return false;
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

/** Filter to presentable listings and rank them best-first. */
export function rankShowcaseServers(
  servers: Server[],
  limit: number,
): Server[] {
  return servers
    .filter(isShowcaseEligible)
    .map((s) => ({ s, score: showcaseScore(s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}
