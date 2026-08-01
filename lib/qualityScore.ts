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
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Great';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Fair';
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
  {
    const max = 25;
    const status = server.healthStatus;
    const isDeadRepo = status === 'archived' || status === 'offline';

    if (repoHosted && !isDeadRepo) {
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

  // 2. Trust & verification (20)
  {
    const max = 20;
    let earned = 0;
    if (server.isOfficial) earned = max;
    else if (server.websiteVerified || server.isPremium) earned = max * 0.6;
    components.push({
      key: 'trust',
      label: 'Verified ownership',
      earned: Math.round(earned),
      max,
      hint: 'Ownership proven via GitHub, DNS, or site badge. Claim your listing to earn this.',
    });
  }

  // 3. Documentation & capabilities (30) — description depth + real, introspected tools.
  // This is the biggest lever because it's the one owners fully control, and a
  // documented tool list is a signal about the server itself, not the community.
  {
    const max = 30;
    const descLen = (server.description || '').trim().length;
    const descScore = ramp(descLen, 400) * 0.6; // ~400 chars ≈ full
    const toolsScore = server.tools && server.tools.length > 0 ? 0.4 : 0;
    components.push({
      key: 'docs',
      label: 'Documentation & tools',
      earned: Math.round(max * (descScore + toolsScore)),
      max,
      hint: 'A rich description and a documented tool list. The clearest way to raise this signal.',
    });
  }

  // 4. Popularity (15) — stars, downloads, and installs, log-scaled. A bonus that
  // reflects adoption; new servers simply haven't earned it yet.
  {
    const max = 15;
    const stars = server.githubStars || 0;
    const downloads = server.npmDownloads || 0;
    const installs = server.copies || 0;
    const magnitude = ramp(stars, 5000) * 0.5 + ramp(downloads, 50000) * 0.3 + ramp(installs, 1000) * 0.2;
    components.push({
      key: 'popularity',
      label: 'Adoption',
      earned: Math.round(max * magnitude),
      max,
      hint: 'GitHub stars, npm downloads, and installs from this directory. Grows over time.',
    });
  }

  // 5. Community engagement (10) — upvotes + views on AllMCPs.
  {
    const max = 10;
    const engagement = ramp(server.upvotes || 0, 100) * 0.6 + ramp(server.views || 0, 5000) * 0.4;
    components.push({
      key: 'engagement',
      label: 'Community engagement',
      earned: Math.round(max * engagement),
      max,
      hint: 'Upvotes and page views on AllMCPs. Grows over time.',
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
      return '#94a3b8'; // slate — neutral, not alarming
    case 'Emerging':
      return '#8b9bb4'; // muted slate — "early", not "failing"
  }
}
