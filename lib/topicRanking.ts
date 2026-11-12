import { type BestTopic, selectServersForTopic } from './bestTopics';
import { trustLabel } from './featuredStatus';
import { hasVerifiedRun } from './listingIndexability';
import { engagementScore } from './search';
import type { Server } from './servers';

/**
 * What a listing we have seen run earns over one we haven't: about the gap
 * between 20 and 400 GitHub stars in engagementScore. A tie-breaker between
 * servers of similar traction, not a way for a zero-star server we happened to
 * run to outrank a vendor's own (at 8, zero-star servers outranked
 * redis/mcp-redis on /best/redis).
 */
const VERIFIED_RUN_BOOST = 4;
/** The vendor's or the MCP project's own server: a small lift, as in search. */
const OFFICIAL_BOOST = 3;

/** Traction worth naming in a "why it's here" line. */
const NOTABLE_STARS = 100;
const NOTABLE_DOWNLOADS = 1000;

type RankedRow = Pick<
  Server,
  | 'name'
  | 'description'
  | 'category'
  | 'upvotes'
  | 'copies'
  | 'views'
  | 'githubStars'
  | 'npmDownloads'
  | 'isOfficial'
  | 'ownerVerified'
  | 'officialSource'
  | 'url'
  | 'toolsSource'
  | 'installNeedsConfig'
  | 'remoteEndpointHealthy'
  | 'remoteEndpointHealthyAt'
>;

function hubScore(s: RankedRow): number {
  const kind = trustLabel(s)?.kind;
  return (
    engagementScore(s) +
    (hasVerifiedRun(s) ? VERIFIED_RUN_BOOST : 0) +
    (kind === 'official' || kind === 'reference' ? OFFICIAL_BOOST : 0)
  );
}

/**
 * A /best topic's ranking: the on-topic listings (selectServersForTopic), servers
 * we have seen work first, then by popularity. Shared by the HTML page and its
 * agent Markdown so both show the same order.
 */
export function rankServersForTopic<T extends RankedRow>(
  topic: BestTopic,
  servers: T[],
): T[] {
  return selectServersForTopic(topic, servers).sort(
    (a, b) => hubScore(b) - hubScore(a),
  );
}

function runEvidence(s: RankedRow): string | null {
  if (s.toolsSource === 'introspected') return 'tools confirmed live over MCP';
  if (s.installNeedsConfig != null)
    return 'starts in our sandbox (needs your API keys)';
  if (hasVerifiedRun(s)) return 'hosted endpoint passed our health check';
  return null;
}

function tractionText(s: RankedRow): string | null {
  const stars = s.githubStars ?? 0;
  const downloads = s.npmDownloads ?? 0;
  const installs = s.copies ?? 0;
  if (stars >= NOTABLE_STARS)
    return `${stars.toLocaleString('en-US')} GitHub stars`;
  if (downloads >= NOTABLE_DOWNLOADS)
    return `${downloads.toLocaleString('en-US')} npm downloads a month`;
  if (installs > 0)
    return `${installs.toLocaleString('en-US')} installs on AllMCPs`;
  return null;
}

/**
 * A factual "why it's here" line built only from what we observed: who publishes
 * it, whether we saw it run, and its traction. It used to call #1 "Most popular
 * in this category on AllMCPs" even with zero installs. Payment never adds a
 * reason.
 */
export function hubReason(s: RankedRow): string {
  const parts: string[] = [];
  const trust = trustLabel(s);
  if (trust?.kind === 'official') parts.push('Official server from the vendor');
  else if (trust?.kind === 'reference')
    parts.push('Reference server from the MCP project');
  else if (trust?.kind === 'owner') parts.push('Owner-verified listing');
  const run = runEvidence(s);
  if (run) parts.push(run);
  const traction = tractionText(s);
  if (traction) parts.push(traction);
  if (parts.length === 0) return 'Matches this topic; not yet verified by us';
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
