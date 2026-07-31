import type { Server } from './servers';

/**
 * Transparent, deterministic listing quality score (0–100) + letter tier.
 *
 * Unlike a black-box rating, every point traces to a signal we actually store,
 * so the breakdown can be shown to users and owners can see how to improve.
 * Computed at render time (no DB column) so it never goes stale relative to the
 * underlying signals. We deliberately do NOT invent an aggregateRating for
 * schema.org — this is an editorial completeness/health score, not a user star
 * rating.
 */

export type ScoreComponent = { key: string; label: string; earned: number; max: number; hint: string };
export type QualityScore = {
  score: number; // 0–100
  tier: 'A' | 'B' | 'C' | 'D' | 'F';
  components: ScoreComponent[];
};

/** log-scaled 0..1 ramp: `value` reaching `full` returns ~1. */
function ramp(value: number, full: number): number {
  if (value <= 0) return 0;
  const v = Math.log10(1 + value) / Math.log10(1 + full);
  return Math.max(0, Math.min(1, v));
}

function tierFor(score: number): QualityScore['tier'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function computeQualityScore(server: Server): QualityScore {
  const components: ScoreComponent[] = [];

  // 1. Health & availability (30)
  {
    const max = 30;
    const status = server.healthStatus;
    let earned = 0;
    if (server.isVerifiedActive || status === 'healthy') earned = max;
    else if (!status || status === 'unknown') earned = max * 0.5;
    else earned = 0; // offline / archived / down
    components.push({
      key: 'health',
      label: 'Health & availability',
      earned: Math.round(earned),
      max,
      hint: 'Recent health check passed and the repo/endpoint is live.',
    });
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
      hint: 'Ownership proven via GitHub, DNS, or site badge.',
    });
  }

  // 3. Popularity (25) — stars, downloads, and installs, log-scaled.
  {
    const max = 25;
    const stars = server.githubStars || 0;
    const downloads = server.npmDownloads || 0;
    const installs = server.copies || 0;
    const magnitude = ramp(stars, 5000) * 0.5 + ramp(downloads, 50000) * 0.3 + ramp(installs, 1000) * 0.2;
    components.push({
      key: 'popularity',
      label: 'Popularity',
      earned: Math.round(max * magnitude),
      max,
      hint: 'GitHub stars, npm downloads, and installs from this directory.',
    });
  }

  // 4. Documentation & completeness (15) — description depth + documented tools.
  {
    const max = 15;
    const descLen = (server.description || '').trim().length;
    const descScore = ramp(descLen, 400) * 0.6; // ~400 chars ≈ full
    const toolsScore = server.tools && server.tools.length > 0 ? 0.4 : 0;
    components.push({
      key: 'docs',
      label: 'Documentation & tools',
      earned: Math.round(max * (descScore + toolsScore)),
      max,
      hint: 'A rich description and a documented tool list.',
    });
  }

  // 5. Community engagement (10) — upvotes + views.
  {
    const max = 10;
    const engagement = ramp(server.upvotes || 0, 100) * 0.6 + ramp(server.views || 0, 5000) * 0.4;
    components.push({
      key: 'engagement',
      label: 'Community engagement',
      earned: Math.round(max * engagement),
      max,
      hint: 'Upvotes and page views on AllMCPs.',
    });
  }

  const score = Math.max(0, Math.min(100, components.reduce((sum, c) => sum + c.earned, 0)));
  return { score, tier: tierFor(score), components };
}

export function tierColor(tier: QualityScore['tier']): string {
  switch (tier) {
    case 'A':
      return '#10b981';
    case 'B':
      return '#22d3ee';
    case 'C':
      return '#f59e0b';
    case 'D':
      return '#f97316';
    case 'F':
      return '#ef4444';
  }
}
