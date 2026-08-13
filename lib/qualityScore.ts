import type { Server } from './servers';

/**
 * Transparent, deterministic listing quality signal (0–100) + a guidance tier.
 *
 * This is a *signal*, not a report card. Every point traces to a public signal we
 * actually store, so the breakdown can be shown to users and owners can see how to
 * improve. Computed at render time (no DB column) so it never goes stale relative
 * to the underlying signals. We deliberately do NOT invent an aggregateRating for
 * schema.org — this is an editorial completeness/health signal, not a user star
 * rating.
 *
 * Two deliberate design choices keep the number fair rather than punitive:
 *
 *  1. No failing grade. The lowest tier is "Emerging", not "F" — a new listing that
 *     simply hasn't accrued community signal yet is just early, not bad. Colors stay
 *     cool/neutral at the low end rather than alarm-red.
 *
 *  2. We only score what we can actually observe about *the server itself*. For a
 *     hosted MCP endpoint we run a real initialize + tools/list handshake, so its
 *     availability is a genuine signal. For a repo-hosted (usually stdio) listing we
 *     can only see the GitHub repo, never the running server — so we do NOT let mere
 *     GitHub reachability count as "healthy". When a component can't be observed it's
 *     marked not-applicable and dropped from the denominator; the score renormalizes
 *     over the signals we can actually measure.
 */

export type ScoreComponent = {
  key: string;
  label: string;
  earned: number;
  max: number;
  hint: string;
  /** When false, the component can't be measured for this listing and is excluded from the score. */
  applicable?: boolean;
};
export type QualityTier = 'Excellent' | 'Great' | 'Good' | 'Fair' | 'Emerging';
export type QualityScore = {
  score: number; // 0–100
  tier: QualityTier;
  components: ScoreComponent[];
};

/** log-scaled 0..1 ramp: `value` reaching `full` returns ~1. */
function ramp(value: number, full: number): number {
  if (value <= 0) return 0;
  const v = Math.log10(1 + value) / Math.log10(1 + full);
  return Math.max(0, Math.min(1, v));
}

function tierFor(score: number): QualityTier {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Great';
  if (score >= 50) return 'Good';
  if (score >= 35) return 'Fair';
  return 'Emerging';
}

/** Does the listing point at a GitHub repo (as opposed to a hosted MCP endpoint we can handshake)? */
function isRepoHosted(url: string): boolean {
  return /github\.com/i.test(url || '');
}

export function computeQualityScore(server: Server): QualityScore {
  const components: ScoreComponent[] = [];
  const repoHosted = isRepoHosted(server.url);

  // 1. Health & availability (25) — of the SERVER, where we can actually reach it.
  //
  // We only run a live MCP handshake against hosted endpoints, so only those get a
  // real availability signal. For a repo-hosted listing we can't see the running
  // server, so we don't score GitHub's up/down status — the one exception is a dead
  // project (archived or a deleted/private repo), which is a real negative signal
  // regardless of transport.
  //
  // A listing can have a hosted remoteEndpointUrl *in addition to* a repo-hosted
  // primary url (e.g. a stdio bridge package that proxies to a real server) — that
  // endpoint's own live handshake is checked first, since it's a genuine signal
  // about the actual running server that repo-hosted status can never provide.
  {
    const max = 25;
    const status = server.healthStatus;
    const isDeadRepo = status === 'archived' || status === 'offline';
    const hasRemoteEndpointSignal = !!server.remoteEndpointUrl && server.remoteEndpointHealthy != null;

    if ((server.isOfficial || server.id === 'allmcps-server') && !isDeadRepo) {
      components.push({
        key: 'health',
        label: 'Server availability',
        earned: max,
        max,
        hint: 'Official flagship server — maintained directly by AllMCPs.com and verified active.',
      });
    } else if (server.combinedAvailabilityPct != null) {
      // Rolling remote-endpoint check history combined with a recent E2B
      // stdio-pilot pass (see computeCombinedAvailabilityPct in
      // lib/servers.ts) — a real observed trend, not one live snapshot. Only
      // set by callers with both signals on hand (currently the detail
      // page); every other caller falls through to the branches below
      // unchanged. Takes priority over the raw snapshot: confirmed in
      // practice, a listing with a working stdio install was showing 0/25
      // purely because its separate remote endpoint had a transient blip at
      // the exact moment of the live check.
      const pct = server.combinedAvailabilityPct;
      components.push({
        key: 'health',
        label: 'Server availability',
        earned: Math.round((pct / 100) * max),
        max,
        hint:
          pct >= 100
            ? 'Confirmed working recently — a live MCP handshake or an automated install/tools check succeeded.'
            : pct > 0
              ? `Reachable in ${Math.round(pct)}% of recent automated checks.`
              : "Recent automated checks haven't been able to reach this server.",
      });
    } else if (hasRemoteEndpointSignal) {
      const isHealthy = server.remoteEndpointHealthy || server.isVerifiedActive || server.toolsSource === 'introspected';
      components.push({
        key: 'health',
        label: 'Server availability',
        earned: isHealthy ? max : 0,
        max,
        hint: server.remoteEndpointHealthy
          ? 'A live MCP handshake against the hosted endpoint succeeded recently.'
          : isHealthy
            ? 'Confirmed active via verified tools introspection.'
            : "The hosted endpoint didn't respond to a live MCP handshake recently.",
      });
    } else if (repoHosted && !isDeadRepo) {
      // Not observable — exclude from the score rather than reward/penalize a ping.
      components.push({
        key: 'health',
        label: 'Server availability',
        earned: 0,
        max,
        applicable: false,
        hint: "Not scored for repo-hosted servers — we can't reach the running server, only its GitHub page. Hosted MCP endpoints are health-checked live.",
      });
    } else {
      let earned = 0;
      if (server.isVerifiedActive || status === 'healthy') earned = max;
      else if (!status || status === 'unknown') earned = max * 0.5;
      else earned = 0; // offline / archived / down
      components.push({
        key: 'health',
        label: 'Server availability',
        earned: Math.round(earned),
        max,
        hint: repoHosted
          ? 'The linked repository appears archived or unavailable.'
          : 'A live MCP handshake against the endpoint succeeded recently.',
      });
    }
  }

  // 2. Trust & verification (20) — proven ownership, badges, and verified domain
  {
    const max = 20;
    let earned = 0;
    let hint = 'Ownership proven via GitHub, DNS, or site badge. Claim your listing to earn full credit.';
    if (server.isOfficial) {
      earned = max;
      hint = 'Official maintainer claimed listing.';
    } else if (server.websiteVerified || server.isPremium) {
      earned = max * 0.7;
      hint = 'Domain control or verified product website linked.';
    } else if (server.reciprocalBadgeOk) {
      earned = max * 0.6;
      hint = 'Verified maintainer reciprocal badge detected on repository or website.';
    } else if (repoHosted) {
      const isHealthyActive = server.isVerifiedActive || server.healthStatus === 'healthy';
      if (isHealthyActive) {
        earned = max * 0.5;
        hint = 'Active community repository with verified uptime.';
      } else {
        earned = max * 0.4;
        hint = 'Valid open-source community repository. Claim your listing to earn full verification credit.';
      }
    }

    // Supply-chain modifier — deliberately small and weighted toward high/
    // critical advisories only (see lib/vulnScan.ts, /api/cron/vuln-scan):
    // most advisories in a typical dependency tree are low-severity/transitive
    // and not exploitable in context, so this must never read as a blanket
    // per-advisory penalty — medium/low counts contribute nothing at all.
    // Unscanned listings (vulnScannedAt == null, true for nearly the entire
    // catalog until the cron catches up) get zero penalty, not exclusion from
    // the denominator — the latter would change what "100%" means catalog-wide
    // during rollout, which is worse than a temporary zero-penalty gap.
    if (server.vulnScannedAt != null) {
      const critical = server.vulnCriticalCount || 0;
      const high = server.vulnHighCount || 0;
      const vulnPenalty = Math.min(max * 0.3, critical * 3 + high * 1.5);
      if (vulnPenalty > 0) {
        earned = Math.max(0, earned - vulnPenalty);
        hint += ` (−${Math.round(vulnPenalty)} for ${critical + high} high-severity supply-chain advisor${critical + high === 1 ? 'y' : 'ies'} on record.)`;
      }
    }

    components.push({
      key: 'trust',
      label: 'Verified ownership',
      earned: Math.round(earned),
      max,
      hint,
    });
  }

  // 3. Documentation & capabilities (30) — description depth + real tools + install readiness + auth.
  {
    const max = 30;
    const descLen = (server.description || '').trim().length;
    const descScore = ramp(descLen, 400) * 0.50; // ~400 chars ≈ 50% of max
    const toolsCount = server.tools ? server.tools.length : 0;
    const hasTools = toolsCount > 0;
    const toolsIntrospected = hasTools && server.toolsSource === 'introspected';
    
    // Base tools credit + schema richness bonus for tool count
    const toolsBase = toolsIntrospected ? 0.35 : hasTools ? 0.25 : descLen >= 120 ? 0.15 : 0;
    const schemaRichnessBonus = hasTools ? ramp(toolsCount, 10) * (toolsIntrospected ? 0.10 : 0.05) : 0;
    const toolsScore = toolsBase + schemaRichnessBonus;
    
    // Ready-to-run install config (npx, uvx, bunx, or remote url)
    const hasInstallHint = !!(server.installCommand || server.installPackage || server.suggestedInstallCommand);
    const installScore = hasInstallHint ? 0.15 : 0;

    // Security & Auth disclosure bonus
    const hasAuthDisclosure = !!(server.authType && server.authType !== 'unknown');
    const authScore = hasAuthDisclosure ? 0.05 : 0;

    const totalDocMag = Math.min(1, descScore + toolsScore + installScore + authScore);

    components.push({
      key: 'docs',
      label: 'Documentation & tools',
      earned: Math.round(max * totalDocMag),
      max,
      hint: toolsIntrospected
        ? 'Rich description, verified tool schemas, and executable install config.'
        : hasTools
          ? 'Rich description and tool list parsed from documentation.'
          : 'Detailed description provided. Documenting structured tool schemas unlocks full credit.',
    });
  }

  // 4. Maintenance & Adoption (15) — commit recency + stars & downloads with decay.
  {
    const max = 15;
    const rawStars = server.githubStars || 0;
    const downloads = server.npmDownloads || 0;
    const installs = server.copies || 0;
    
    let commitAgeDays = -1;
    let recencyWeight = 0;
    if (server.lastCommitAt) {
      commitAgeDays = (Date.now() - new Date(server.lastCommitAt).getTime()) / (1000 * 60 * 60 * 24);
      if (commitAgeDays <= 30) recencyWeight = 0.25;
      else if (commitAgeDays <= 90) recencyWeight = 0.15;
      else if (commitAgeDays <= 180) recencyWeight = 0.05;
      else recencyWeight = 0.00;
    } else {
      recencyWeight = 0.05; // neutral fallback
    }

    // Stale star decay: discount stars by 50% if the repository hasn't had a commit in >365 days
    const stars = (commitAgeDays > 365) ? rawStars * 0.5 : rawStars;

    const adoptionScale = ramp(stars, 1000) * 0.4 + ramp(downloads, 5000) * 0.25 + ramp(installs, 250) * 0.1;
    const totalMag = Math.min(1, adoptionScale + recencyWeight);

    components.push({
      key: 'popularity',
      label: 'Adoption & activity',
      earned: Math.round(max * totalMag),
      max,
      hint: 'GitHub stars, npm downloads, directory installs, and commit recency.',
    });
  }

  // 5. Community engagement (10) — upvotes + views + user reviews on AllMCPs.
  {
    const max = 10;

    // Bayesian shrinkage toward a neutral 3.5/5 baseline so 1-2 early five-star
    // reviews can't swing an established listing's score — shrinkage constant
    // REVIEW_SHRINKAGE_C=5 means a listing needs ~5 reviews before its own
    // average starts to dominate the blend. reviewCount/avgRating are only
    // populated where a caller has already paid for the reviews join (see
    // lib/servers.ts's Server.reviewCount doc) — undefined behaves like 0,
    // same "just early, not penalized" treatment as every other signal here.
    const REVIEW_PRIOR = 3.5;
    const REVIEW_SHRINKAGE_C = 5;
    const reviewCount = server.reviewCount || 0;
    const avgRating = server.avgRating || 0;
    const bayesianAvg =
      reviewCount > 0
        ? (reviewCount * avgRating + REVIEW_SHRINKAGE_C * REVIEW_PRIOR) / (reviewCount + REVIEW_SHRINKAGE_C)
        : 0;
    const reviewScore = reviewCount > 0 ? Math.max(0, Math.min(1, (bayesianAvg - 1) / 4)) : 0;

    const engagement =
      ramp(server.upvotes || 0, 100) * 0.45 +
      ramp(server.views || 0, 5000) * 0.3 +
      reviewScore * 0.25;

    components.push({
      key: 'engagement',
      label: 'Community engagement',
      earned: Math.round(max * engagement),
      max,
      hint:
        reviewCount > 0
          ? `Upvotes, page views, and ${reviewCount} user review${reviewCount === 1 ? '' : 's'} on AllMCPs.`
          : 'Upvotes and page views on AllMCPs. User reviews add to this once the listing has some.',
    });
  }

  // Renormalize over the components we can actually measure, so an unobservable
  // signal neither helps nor hurts.
  const scored = components.filter((c) => c.applicable !== false);
  const totalMax = scored.reduce((sum, c) => sum + c.max, 0);
  const totalEarned = scored.reduce((sum, c) => sum + c.earned, 0);
  const score = totalMax > 0 ? Math.max(0, Math.min(100, Math.round((totalEarned / totalMax) * 100))) : 0;
  return { score, tier: tierFor(score), components };
}

export function tierColor(tier: QualityTier): string {
  switch (tier) {
    case 'Excellent':
      return '#10b981'; // emerald
    case 'Great':
      return '#22d3ee'; // cyan
    case 'Good':
      return '#f59e0b'; // amber
    case 'Fair':
      return '#6366f1'; // indigo — distinct vibrant purple/blue
    case 'Emerging':
      return '#64748b'; // slate — cool dark neutral
  }
}
