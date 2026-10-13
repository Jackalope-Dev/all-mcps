/**
 * Which listings are dead, abandoned or fake — decided as a pure function so
 * the rules that lead to removal are tested, not buried in a cron.
 *
 * Removal is staged (see /api/cron/stale-sweep):
 *   1. a listing that matches any rule is flagged: noindexed straight away and
 *      shown in the admin triage queue;
 *   2. if every reason is auto-removable and still holds after STALE_GRACE_MS,
 *      the sweep moves it to 'removed';
 *   3. a listing that stops matching is unflagged on the next sweep.
 *
 * Every rule needs at least two independent signals or one that is definitive
 * on its own (a registry deprecation notice). Being old is never enough:
 * plenty of finished, working servers have not needed a commit in a year.
 */

export type StaleReason =
  /** The registry marks the package deprecated. */
  | 'package-deprecated'
  /** The registry no longer has the package and there is no other way to run it. */
  | 'package-missing'
  /** Two separate sandbox runs failed to install it, and nothing has ever introspected it. */
  | 'install-broken'
  /** No commit in a year, never verified, and no traction. */
  | 'abandoned'
  /** A fork with no traction of its own, never verified. */
  | 'unmodified-fork'
  /** Jev is confident this is not an MCP server. Flag-only: always needs a human. */
  | 'not-mcp';

/** Reasons the sweep may act on without a human. 'not-mcp' is a model judgment, so it never is. */
const AUTO_REMOVABLE_REASONS: ReadonlySet<StaleReason> = new Set([
  'package-deprecated',
  'package-missing',
  'install-broken',
  'abandoned',
  'unmodified-fork',
]);

export const STALE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
const ABANDONED_AFTER_MS = 365 * 24 * 60 * 60 * 1000;
const TRACTION_STARS = 10;
const TRACTION_NPM = 100;
const NOT_MCP_FLOOR = 0.15;

export type StalenessInput = {
  now: Date;
  isPremium?: boolean | null;
  isOfficial?: boolean | null;
  featuredUntil?: Date | null;
  ownerUserId?: string | null;
  /** An admin chose to keep this listing from the triage queue. */
  curatorKeptAt?: Date | null;
  lastCommitAt?: Date | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
  toolsSource?: string | null;
  installNeedsConfig?: Date | null;
  remoteEndpointHealthy?: boolean | null;
  installKind?: string | null;
  packageDeprecated?: string | null;
  /** True only when the registry answered and said the package does not exist. */
  packageMissing?: boolean | null;
  /** Consecutive E2B install_failed results. */
  installFailures?: number | null;
  repoForkOf?: string | null;
  mcpProbability?: number | null;
};

export function assessStaleness(s: StalenessInput): StaleReason[] {
  // Paid, claimed, official and curator-kept listings have a human who
  // answers for them.
  if (
    s.curatorKeptAt ||
    s.isPremium ||
    s.isOfficial ||
    s.ownerUserId ||
    (s.featuredUntil && s.featuredUntil > s.now)
  ) {
    return [];
  }

  const verified =
    s.toolsSource === 'introspected' ||
    s.installNeedsConfig != null ||
    s.remoteEndpointHealthy === true;
  const hasTraction =
    (s.githubStars ?? 0) >= TRACTION_STARS ||
    (s.npmDownloads ?? 0) >= TRACTION_NPM;
  const reasons: StaleReason[] = [];

  if (s.packageDeprecated) reasons.push('package-deprecated');
  if (s.packageMissing && s.remoteEndpointHealthy !== true && !verified)
    reasons.push('package-missing');
  if ((s.installFailures ?? 0) >= 2 && !verified)
    reasons.push('install-broken');
  if (
    !verified &&
    !hasTraction &&
    s.lastCommitAt != null &&
    s.now.getTime() - s.lastCommitAt.getTime() > ABANDONED_AFTER_MS
  ) {
    reasons.push('abandoned');
  }
  if (s.repoForkOf && !verified && (s.githubStars ?? 0) < TRACTION_STARS)
    reasons.push('unmodified-fork');
  if (typeof s.mcpProbability === 'number' && s.mcpProbability < NOT_MCP_FLOOR)
    reasons.push('not-mcp');

  return reasons;
}

/** Whether a flagged listing has served its grace period and may be removed without a human. */
export function shouldAutoRemove(
  reasons: StaleReason[],
  flaggedAt: Date | null,
  now: Date,
): boolean {
  if (reasons.length === 0 || !flaggedAt) return false;
  if (!reasons.every((r) => AUTO_REMOVABLE_REASONS.has(r))) return false;
  return now.getTime() - flaggedAt.getTime() >= STALE_GRACE_MS;
}

export function parseStaleReasons(
  raw: string | null | undefined,
): StaleReason[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean) as StaleReason[];
}

export const STALE_REASON_LABEL: Record<StaleReason, string> = {
  'package-deprecated': 'Package deprecated on the registry',
  'package-missing': 'Package no longer on the registry',
  'install-broken': 'Failed to install in two sandbox runs',
  abandoned: 'No commits in a year, never verified, no traction',
  'unmodified-fork': 'Fork with no traction of its own',
  'not-mcp': 'Jev: probably not an MCP server',
};
