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
 *
 * Security reasons (tool poisoning, risky install, typosquat, package/repo
 * mismatch, repeated malicious reports) hide a listing the same way but are
 * never auto-removed: a human confirms every one from the triage queue.
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
  /** Our own check found the source repo gone (404/410/451) twice, a day apart, and nothing else runs it. */
  | 'repo-gone'
  /**
   * A non-GitHub listing's site has failed every health check for
   * SITE_DOWN_AFTER_MS (see siteDownFromHistory), and nothing else runs it.
   */
  | 'site-down'
  /** Jev is confident this is not an MCP server. Flag-only: always needs a human. */
  | 'not-mcp'
  /**
   * Jev's triage said reject *and* its is-MCP probability is low. Two model
   * answers agreeing is enough to hide the listing (noindex), never to remove
   * it — flag-only, like not-mcp.
   */
  | 'jev-reject'
  /**
   * A live tool description tries to steer the assistant (override
   * instructions, hide things from the user, hidden instruction blocks).
   * Security reasons are flag-only and, unlike the rest, apply to paid and
   * claimed listings too: paying for a listing does not make its tools safe.
   */
  | 'tool-poisoning'
  /** The install command pipes a download into a shell, decodes a payload, or fetches code from an arbitrary host (lib/installRisk.ts). */
  | 'risky-install'
  /** The install package's name imitates a far more used package (lib/typosquat.ts). */
  | 'typosquat'
  /** The install package's registry metadata names a different GitHub repo than the listing. */
  | 'package-repo-mismatch'
  /** Several different visitors reported it as malicious and nobody has reviewed the reports yet. */
  | 'reported-malicious';

/** Reasons the sweep may act on without a human. 'not-mcp' is a model judgment, so it never is. */
const AUTO_REMOVABLE_REASONS: ReadonlySet<StaleReason> = new Set([
  'package-deprecated',
  'package-missing',
  'install-broken',
  'abandoned',
  'unmodified-fork',
  'repo-gone',
  'site-down',
]);

/**
 * Reasons that don't come from the model and so describe the listing itself.
 * Only these reset Jev's triage verdict when they change: 'jev-reject' is
 * derived *from* the verdict, so letting it reset the verdict would loop.
 */
/** Open 'malicious' reports from this many distinct reporters hide a listing until an admin reviews them. */
const MALICIOUS_REPORT_THRESHOLD = 3;

export function evidenceReasons(reasons: StaleReason[]): StaleReason[] {
  return reasons.filter((r) => r !== 'jev-reject');
}

export const STALE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * A confirmed-gone source repo is about as definitive as it gets, so it waits
 * a week rather than a month. The rest keep the full grace period.
 */
const GRACE_BY_REASON: Partial<Record<StaleReason, number>> = {
  'repo-gone': 7 * 24 * 60 * 60 * 1000,
  // Already down for SITE_DOWN_AFTER_MS before it is flagged, so ~4 weeks of
  // continuous failure in all before removal.
  'site-down': 14 * 24 * 60 * 60 * 1000,
};

/**
 * How long a site must fail every check before it counts as down. Failing
 * listings are rechecked every 6h (lib/healthTier.ts), so this is dozens of
 * failed checks, not a couple of unlucky ones.
 */
const SITE_DOWN_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
/** Failed checks needed inside that window, so one stale reading never counts. */
const SITE_DOWN_MIN_FAILS = 4;

export type HealthHistorySummary = {
  /** Newest healthy check, or null when the history holds none. */
  lastHealthyAt: Date | null;
  /** Oldest failed check after lastHealthyAt. */
  firstFailAt: Date | null;
  /** Failed checks after lastHealthyAt. */
  fails: number;
};

/** The listing's own site has been down continuously for SITE_DOWN_AFTER_MS. */
export function siteDownFromHistory(
  h: HealthHistorySummary | undefined,
  now: Date,
): boolean {
  if (!h?.firstFailAt || h.fails < SITE_DOWN_MIN_FAILS) return false;
  return now.getTime() - h.firstFailAt.getTime() >= SITE_DOWN_AFTER_MS;
}
export const JEV_REJECT_MCP_CEILING = 0.3;
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
  /** Source repo confirmed gone by lib/repoCheck.ts (two sightings a day apart). */
  repoGoneConfirmed?: boolean | null;
  /** The registry answered and the package exists and is not deprecated. */
  packageAlive?: boolean | null;
  /** siteDownFromHistory for a listing whose url is not a GitHub repo. */
  siteDown?: boolean | null;
  /** Jev's settled triage verdict (lib/listingReview.ts). */
  triageVerdict?: string | null;
  /** The security profile holds a strong tool-poisoning finding (lib/securityProfile.ts hasStrongPoisoning). */
  toolPoisoning?: boolean | null;
  /** lib/installRisk.ts found something in the cached install. */
  installRisk?: boolean | null;
  /** The popular package this one's name imitates (lib/typosquat.ts). */
  typosquatOf?: string | null;
  /** Package registry repo and listing repo are both known and differ. */
  packageRepoMismatch?: boolean | null;
  /** Distinct reporters with an open 'malicious' report in the last 30 days. */
  maliciousReporters?: number | null;
};

/** Security findings, assessed for every listing except official and curator-kept ones. */
function securityReasons(s: StalenessInput): StaleReason[] {
  if (s.curatorKeptAt || s.isOfficial) return [];
  const out: StaleReason[] = [];
  if (s.toolPoisoning) out.push('tool-poisoning');
  if (s.installRisk) out.push('risky-install');
  if (s.typosquatOf) out.push('typosquat');
  if (s.packageRepoMismatch) out.push('package-repo-mismatch');
  // Anonymous reports alone never hide a paid or claimed listing (a cheap
  // way to knock out a competitor); an admin is emailed on every report.
  const hasOwner =
    s.isPremium ||
    s.ownerUserId ||
    (s.featuredUntil && s.featuredUntil > s.now);
  if (!hasOwner && (s.maliciousReporters ?? 0) >= MALICIOUS_REPORT_THRESHOLD)
    out.push('reported-malicious');
  return out;
}

export function assessStaleness(s: StalenessInput): StaleReason[] {
  const security = securityReasons(s);
  // Paid, claimed, official and curator-kept listings have a human who
  // answers for them — for staleness. Security findings still apply.
  if (
    s.curatorKeptAt ||
    s.isPremium ||
    s.isOfficial ||
    s.ownerUserId ||
    (s.featuredUntil && s.featuredUntil > s.now)
  ) {
    return security;
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
  // A deleted repo whose package still installs is still usable, so the
  // package has to be gone or absent too.
  if (s.repoGoneConfirmed && !verified && !s.packageAlive)
    reasons.push('repo-gone');
  // Same bar for a dead website: a live package or endpoint still serves it.
  if (s.siteDown && !verified && !s.packageAlive) reasons.push('site-down');
  if (typeof s.mcpProbability === 'number' && s.mcpProbability < NOT_MCP_FLOOR)
    reasons.push('not-mcp');
  if (
    s.triageVerdict === 'reject' &&
    !verified &&
    typeof s.mcpProbability === 'number' &&
    s.mcpProbability < JEV_REJECT_MCP_CEILING
  ) {
    reasons.push('jev-reject');
  }

  return [...reasons, ...security];
}

/** Whether a flagged listing has served its grace period and may be removed without a human. */
export function shouldAutoRemove(
  reasons: StaleReason[],
  flaggedAt: Date | null,
  now: Date,
): boolean {
  if (reasons.length === 0 || !flaggedAt) return false;
  if (!reasons.every((r) => AUTO_REMOVABLE_REASONS.has(r))) return false;
  // Every reason is a hard signal, so the most definitive one sets the wait.
  const grace = Math.min(
    ...reasons.map((r) => GRACE_BY_REASON[r] ?? STALE_GRACE_MS),
  );
  return now.getTime() - flaggedAt.getTime() >= grace;
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
  'repo-gone': 'Source repo gone (404), nothing else runs it',
  'site-down': 'Website down for 2+ weeks, nothing else runs it',
  'not-mcp': 'Jev: probably not an MCP server',
  'jev-reject': 'Jev: reject, and probably not an MCP server',
  'tool-poisoning': 'A tool description tries to instruct the AI assistant',
  'risky-install': 'Install command downloads and runs code outside a registry',
  typosquat: 'Package name imitates a much more popular package',
  'package-repo-mismatch':
    "The install package comes from a different repo than this listing's",
  'reported-malicious': 'Reported as malicious by several visitors',
};

export type PendingAutoInput = {
  /** A human submitted it through /submit (submitterEmail set). */
  submitted: boolean;
  /** A sandbox handshake succeeded or it ran and asked for keys. */
  sandboxProven: boolean;
  repoGoneConfirmed: boolean;
  triageVerdict: string | null;
  mcpProbability: number | null;
};

/**
 * Whether a pending listing can be removed from the queue without a human.
 * Only ever for ingested rows: someone who submitted by hand gets a human
 * decision and an email. Moves to 'removed' (republishable), never deletes.
 */
export function pendingAutoRemoveReason(s: PendingAutoInput): string | null {
  if (s.submitted || s.sandboxProven) return null;
  if (s.repoGoneConfirmed) return 'source repo gone (404 twice, a day apart)';
  if (
    s.triageVerdict === 'reject' &&
    s.mcpProbability !== null &&
    s.mcpProbability < JEV_REJECT_MCP_CEILING
  ) {
    return `Jev reject, MCP ${Math.round(s.mcpProbability * 100)}%`;
  }
  return null;
}
