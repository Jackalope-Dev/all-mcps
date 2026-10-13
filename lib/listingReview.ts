/**
 * Structured review of a listing: is it really an MCP server, and how usable is
 * its description?
 *
 * Liveness checks answer "does this URL resolve", which is not the same as "is
 * this an MCP server". A reachable repo that turns out to be an MCP *client*, a
 * curated list, or an unrelated tool passes every reachability test we have and
 * still does not belong in the directory — the reason `delist-mismatched-repos`
 * and the repo-identity token heuristics exist at all.
 *
 * Both questions ride in a single request. The API answers several questions at
 * roughly the cost of one, so there is no reason to split them.
 *
 * Every function here falls back to a permissive result when Jev is unavailable:
 * a listing is never rejected because the review could not run. Failing closed
 * would let an outage silently stop the promotion pipeline.
 */

import type { RepoStatus } from './repoCheck';
import {
  askJev,
  type JevNoulQuestion,
  type JevScoreQuestion,
  nearestScoreLevel,
  noulVerdict,
} from './typesafe';

/**
 * Below this we treat "is an MCP server" as unproven.
 *
 * Deliberately far below the midpoint, because this gates automated
 * *rejection*. Measured against live listings, the two populations sit a long
 * way apart but not symmetrically: a curated list ("awesome-mcp-servers")
 * scored 0.02, while genuine servers ranged from 0.36 (a thinly-described
 * monitoring server) to 0.78. A floor anywhere near 0.5 would have held back
 * that real server. This sits in the empty band between the two.
 */
const MCP_SERVER_NOUL_FLOOR = 0.15;

/** Ordered lowest-to-highest; `score` comes back as a position across these. */
const LISTING_QUALITY_LEVELS = [
  'useless',
  'thin',
  'adequate',
  'good',
  'excellent',
];

const isMcpServerQuestion: JevNoulQuestion = {
  type: 'noul',
  instructions:
    'This project is genuinely an MCP (Model Context Protocol) server that exposes tools, resources, or prompts to an AI client. It is not merely an MCP client, an editor plugin, a curated list of servers, or an unrelated tool.',
  criteria: {
    true: 'It implements an MCP server',
    false: 'It is a client, a list, documentation, or unrelated software',
  },
};

const listingQualityQuestion: JevScoreQuestion = {
  type: 'score',
  instructions:
    'How complete and informative is this listing for a developer deciding whether to install it? Consider whether it explains what the server does and what it connects to.',
  criteria: LISTING_QUALITY_LEVELS,
};

export type ListingForReview = {
  name?: string | null;
  description?: string | null;
  url?: string | null;
};

export type ListingReview = {
  /** Null when unknown — Jev unavailable, or the answer was unusable. */
  isMcpServer: boolean | null;
  /** 0..1 truth probability, or null when unknown. */
  mcpServerProbability: number | null;
  /** Position across LISTING_QUALITY_LEVELS, or null when unknown. */
  qualityScore: number | null;
  /** True only when Jev actually answered. */
  reviewed: boolean;
};

const UNREVIEWED: ListingReview = {
  isMcpServer: null,
  mcpServerProbability: null,
  qualityScore: null,
  reviewed: false,
};

/**
 * Review a listing. Returns an all-null review when Jev is unavailable, which
 * every caller must read as "no opinion", never as "failed review".
 *
 * Never throws.
 */
export async function reviewListing(
  listing: ListingForReview,
): Promise<ListingReview> {
  if (!listing.name && !listing.description) return UNREVIEWED;

  const res = await askJev(
    {
      name: listing.name ?? '',
      description: listing.description ?? '',
      url: listing.url ?? '',
    },
    {
      is_mcp_server: isMcpServerQuestion,
      listing_quality: listingQualityQuestion,
    },
  );
  if (!res) return UNREVIEWED;

  const mcp = res.answers.is_mcp_server;
  const quality = res.answers.listing_quality;

  return {
    isMcpServer: noulVerdict(mcp, MCP_SERVER_NOUL_FLOOR),
    mcpServerProbability: typeof mcp?.noul === 'number' ? mcp.noul : null,
    qualityScore: typeof quality?.score === 'number' ? quality.score : null,
    reviewed: true,
  };
}

/**
 * Columns to persist a review onto `servers`. Empty when Jev did not answer,
 * so an outage never overwrites an earlier real verdict with nulls.
 */
export function reviewColumns(review: ListingReview, now = new Date()) {
  if (!review.reviewed) return {};
  return {
    mcpProbability: review.mcpServerProbability,
    listingQuality: review.qualityScore,
    reviewedAt: now,
  };
}

/**
 * Whether a pending listing should be held back from automated promotion.
 *
 * Only ever true when Jev actually answered *and* judged the project not to be
 * an MCP server. Unknown means promote, matching the behaviour before this
 * check existed.
 */
export function shouldHoldFromAutoPromotion(review: ListingReview): boolean {
  return review.reviewed && review.isMcpServer === false;
}

/**
 * Skip the expensive GPT writeup when Jev already judged the row not worth
 * original directory copy. Unknown (Jev down) never skips — fail open.
 */
export function shouldSkipAiWriteup(review: ListingReview): boolean {
  if (!review.reviewed) return false;
  if (review.isMcpServer === false) return true;
  // 0 = useless on LISTING_QUALITY_LEVELS. Thin (1) still gets a writeup.
  return review.qualityScore !== null && review.qualityScore < 1;
}

/**
 * Ordered outcomes for a candidate pair. TypeSafe's entity-alignment pattern:
 * the levels *are* the actions, so there is no extra noul threshold to fit.
 */
const DUPLICATE_ALIGNMENT_LEVELS = [
  'different',
  'needs_review',
  'same',
] as const;

export type DuplicateAlignment = (typeof DUPLICATE_ALIGNMENT_LEVELS)[number];

const alignmentQuestion: JevScoreQuestion = {
  type: 'score',
  instructions:
    'How do these two directory listings relate as MCP server products?',
  criteria: [
    'Different projects — leave them as separate listings.',
    'Unclear — a human curator should decide before merging.',
    'Same underlying project, duplicated in the directory.',
  ],
};

/**
 * Same-project check for a pair the deterministic keys already consider
 * near-duplicates. Returns null when Jev is unavailable.
 */
export async function alignListings(
  a: ListingForReview,
  b: ListingForReview,
): Promise<DuplicateAlignment | null> {
  const res = await askJev(
    {
      listing_a: {
        name: a.name ?? '',
        description: a.description ?? '',
        url: a.url ?? '',
      },
      listing_b: {
        name: b.name ?? '',
        description: b.description ?? '',
        url: b.url ?? '',
      },
    },
    { link_state: alignmentQuestion },
  );
  if (!res) return null;
  const level = nearestScoreLevel(
    res.answers.link_state,
    DUPLICATE_ALIGNMENT_LEVELS,
  );
  return level;
}

/**
 * Admin triage: what should a curator do with this listing? The levels are
 * the actions, same pattern as DUPLICATE_ALIGNMENT_LEVELS.
 */
const TRIAGE_LEVELS = ['reject', 'needs_review', 'approve'] as const;
export type TriageVerdict = (typeof TRIAGE_LEVELS)[number];

const triageQuestion: JevScoreQuestion = {
  type: 'score',
  instructions:
    'You are curating a directory of MCP (Model Context Protocol) servers. Given the listing and the evidence we collected, what should the curator do? Approve genuine, usable MCP servers. Reject clients, curated lists, tutorials, empty or placeholder repos, forks with no changes, and spam. Choose needs_review only when the evidence genuinely conflicts.',
  criteria: [
    'Reject — not a genuine, usable MCP server for this directory.',
    'Needs review — the evidence conflicts; a human should look.',
    'Approve — a genuine MCP server worth listing.',
  ],
};

/** Hard evidence handed to Jev alongside the listing text, and echoed back in the reason. */
export type TriageEvidence = {
  sandboxStatus?: string | null;
  toolCount?: number | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
  lastCommitAt?: Date | null;
  repoForkOf?: string | null;
  staleReasons?: string[];
  readme?: string | null;
  /** Our own check of the source URL (lib/repoCheck.ts). */
  repoStatus?: RepoStatus | null;
};

export type ListingTriage = ListingReview & {
  verdict: TriageVerdict | null;
  /** Confidence in `verdict`, 0..1, or null when unknown. */
  verdictConfidence: number | null;
  reason: string | null;
};

/** Below this confidence an approve/reject is downgraded to needs_review. */
const TRIAGE_CONFIDENCE_FLOOR = 0.7;

/**
 * Full review plus a curator recommendation, in one Jev request. Never throws;
 * all-null when Jev is unavailable.
 */
export async function triageListing(
  listing: ListingForReview,
  evidence: TriageEvidence,
): Promise<ListingTriage> {
  const empty: ListingTriage = {
    ...UNREVIEWED,
    verdict: null,
    verdictConfidence: null,
    reason: null,
  };
  if (!listing.name && !listing.description) return empty;

  const res = await askJev(
    {
      name: listing.name ?? '',
      description: listing.description ?? '',
      url: listing.url ?? '',
      readme: (evidence.readme ?? '').slice(0, 3000),
      evidence: {
        sandbox_result: evidence.sandboxStatus ?? 'not tested',
        tools_found: evidence.toolCount ?? 0,
        github_stars: evidence.githubStars ?? null,
        npm_monthly_downloads: evidence.npmDownloads ?? null,
        last_commit: evidence.lastCommitAt?.toISOString().slice(0, 10) ?? null,
        fork_of: evidence.repoForkOf ?? null,
        stale_signals: evidence.staleReasons ?? [],
        source_repo: evidence.repoStatus ?? 'not checked',
      },
    },
    {
      is_mcp_server: isMcpServerQuestion,
      listing_quality: listingQualityQuestion,
      triage: triageQuestion,
    },
  );
  if (!res) return empty;

  const mcp = res.answers.is_mcp_server;
  const quality = res.answers.listing_quality;
  const triage = res.answers.triage;
  const review: ListingReview = {
    isMcpServer: noulVerdict(mcp, MCP_SERVER_NOUL_FLOOR),
    mcpServerProbability: typeof mcp?.noul === 'number' ? mcp.noul : null,
    qualityScore: typeof quality?.score === 'number' ? quality.score : null,
    reviewed: true,
  };
  const raw = nearestScoreLevel(triage, TRIAGE_LEVELS);
  const confidence =
    typeof triage?.confidence === 'number' ? triage.confidence : null;
  const verdict = settleVerdict(raw, confidence, review, evidence);
  return {
    ...review,
    verdict,
    verdictConfidence: confidence,
    reason: verdict ? explainTriage(verdict, review, evidence) : null,
  };
}

/**
 * Apply hard evidence on top of the model's answer. A completed sandbox
 * handshake is proof, so it can never be auto-rejected; an unsure model never
 * gets to approve or reject on its own.
 */
export function settleVerdict(
  raw: TriageVerdict | null,
  confidence: number | null,
  review: ListingReview,
  evidence: TriageEvidence,
): TriageVerdict | null {
  if (raw === null) return null;
  const proven =
    evidence.sandboxStatus === 'ok' ||
    evidence.sandboxStatus === 'needs_credentials';
  if (raw === 'reject' && proven) return 'needs_review';
  // A source URL that returns 404 is a fact, not a judgment: reject unless
  // the server was proven to run anyway (then a human decides).
  if (evidence.repoStatus === 'gone') return proven ? 'needs_review' : 'reject';
  if (raw !== 'needs_review' && (confidence ?? 0) < TRIAGE_CONFIDENCE_FLOOR)
    return 'needs_review';
  // The model said approve but its own is-MCP answer says no: conflicting.
  if (raw === 'approve' && review.isMcpServer === false) return 'needs_review';
  return raw;
}

/** Human-readable one-liner for the admin card, built from facts, not model prose. */
export function explainTriage(
  verdict: TriageVerdict,
  review: ListingReview,
  evidence: TriageEvidence,
): string {
  const parts: string[] = [];
  if (review.mcpServerProbability !== null)
    parts.push(`MCP ${Math.round(review.mcpServerProbability * 100)}%`);
  if (review.qualityScore !== null) {
    const level =
      LISTING_QUALITY_LEVELS[
        Math.max(
          0,
          Math.min(
            LISTING_QUALITY_LEVELS.length - 1,
            Math.round(review.qualityScore),
          ),
        )
      ];
    parts.push(`copy ${level}`);
  }
  if (evidence.sandboxStatus) {
    parts.push(
      evidence.sandboxStatus === 'ok'
        ? `handshake ok (${evidence.toolCount ?? 0} tools)`
        : `sandbox ${evidence.sandboxStatus.replace(/_/g, ' ')}`,
    );
  }
  if (evidence.repoStatus === 'gone') parts.push('source 404');
  if (evidence.repoStatus === 'archived') parts.push('repo archived');
  if (evidence.repoStatus === 'site_only')
    parts.push('repo 404 but website live');
  if (evidence.repoForkOf) parts.push(`fork of ${evidence.repoForkOf}`);
  if (evidence.staleReasons?.length)
    parts.push(`stale: ${evidence.staleReasons.join(', ')}`);
  const lead =
    verdict === 'approve'
      ? 'Approve'
      : verdict === 'reject'
        ? 'Reject'
        : 'Look closer';
  return `${lead} — ${parts.join(' · ') || 'little evidence either way'}`;
}
