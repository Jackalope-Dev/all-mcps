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
export const MCP_SERVER_NOUL_FLOOR = 0.15;

/** Ordered lowest-to-highest; `score` comes back as a position across these. */
export const LISTING_QUALITY_LEVELS = [
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
export const DUPLICATE_ALIGNMENT_LEVELS = [
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

/** True only for a confident "same project". Null when Jev had no opinion. */
export async function areListingsDuplicates(
  a: ListingForReview,
  b: ListingForReview,
): Promise<boolean | null> {
  const alignment = await alignListings(a, b);
  if (alignment === null) return null;
  return alignment === 'same';
}
