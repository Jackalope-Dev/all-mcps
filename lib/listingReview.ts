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
 * Are two listings the same underlying project?
 *
 * Used only for pairs the deterministic keys (repo URL, name + website) already
 * consider near-duplicates. Returns null when Jev is unavailable, so the caller
 * keeps whatever its own heuristics decided.
 */
export async function areListingsDuplicates(
  a: ListingForReview,
  b: ListingForReview,
  minProbability = 0.8,
): Promise<boolean | null> {
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
    {
      same_project: {
        type: 'noul',
        instructions:
          'listing_a and listing_b describe the same underlying MCP server project, rather than two different projects that happen to be similar or share a publisher.',
        criteria: {
          true: 'Same project, duplicated in the directory',
          false: 'Genuinely different projects',
        },
      },
    },
  );
  if (!res) return null;

  return noulVerdict(res.answers.same_project, minProbability);
}
