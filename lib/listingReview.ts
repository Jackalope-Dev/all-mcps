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

import { fetchGithubReadme } from './listingEnrich';
import type { RepoStatus } from './repoCheck';
import { githubRepoSlug } from './repoUrl';
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
    'This project provides an MCP (Model Context Protocol) server that exposes tools, resources, or prompts to an AI client. The MCP server may be the whole project or one part of a larger product: a hosted MCP endpoint from a SaaS or API vendor, the official MCP integration of an app, a package or CLI that can also run as an MCP server, or a monorepo that contains one all count. It does not count when the project is only an MCP client, a curated list of servers, documentation or a registry manifest with no server code and no endpoint, or unrelated software.',
  criteria: {
    true: 'It provides an MCP server, on its own or as part of a larger product',
    false:
      'It is only a client, a list, docs or a manifest with no server, or unrelated software',
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
 * Admin triage: what should a curator do with this listing?
 *
 * This used to be one 3-level Score (reject / needs_review / approve). An
 * unsure model lands an ordinal rubric on its middle level at low confidence,
 * so in practice it never said approve — every listing came back
 * needs_review. Instead Jev now answers several scoped yes/no (noul)
 * questions, and the verdict is derived from their probabilities by
 * deriveTriageVerdict with the thresholds below. Each probability is stored
 * in the reason, so a verdict explains which question decided it.
 */
const TRIAGE_LEVELS = ['reject', 'needs_review', 'approve'] as const;
export type TriageVerdict = (typeof TRIAGE_LEVELS)[number];

const isSubstantiveQuestion: JevNoulQuestion = {
  type: 'noul',
  instructions:
    'This is a real project with its own working implementation. It is not an empty or placeholder repository, a tutorial or course exercise, a hello-world demo, a boilerplate template, an unmodified fork, or spam.',
  criteria: {
    true: 'A real project with its own implementation',
    false:
      'Empty, placeholder, tutorial, demo, template, unmodified fork, or spam',
  },
};

const isUsableQuestion: JevNoulQuestion = {
  type: 'noul',
  instructions:
    'A developer could install or connect to this server today from the information given: a published package, an install command, a documented hosted endpoint, or clear setup instructions. A hosted endpoint that needs an account, OAuth, an API key, or a paid plan still counts as usable.',
  criteria: {
    true: 'There is a clear way to install or connect to it',
    false: 'No usable install or connection path is given',
  },
};

const isLegitimateQuestion: JevNoulQuestion = {
  type: 'noul',
  instructions:
    'This listing is a legitimate, honestly described software project. It is not spam, a marketing or SEO page for an unrelated business, a scam, malware, or an impersonation of another project.',
  criteria: {
    true: 'Legitimate and honestly described',
    false: 'Spam, unrelated marketing, scam, malware, or impersonation',
  },
};

const belongsInDirectoryQuestion: JevNoulQuestion = {
  type: 'noul',
  instructions:
    'Taking all the evidence together, a careful curator of a public directory of MCP (Model Context Protocol) servers would list this: it offers a genuine, usable MCP server (on its own or as part of a larger product) that developers could find useful. The directory does not exclude servers for being paid, requiring an account or OAuth, or serving a narrow audience; it excludes duplicates, spam, and fake or non-MCP listings.',
  criteria: {
    true: 'It belongs in the directory',
    false: 'It does not belong in the directory',
  },
};

/** Per-question probabilities, 0..1, or null when that answer was unusable. */
export type TriageMatrix = {
  isMcpServer: number | null;
  isSubstantive: number | null;
  isUsable: number | null;
  isLegitimate: number | null;
  belongsInDirectory: number | null;
};

/**
 * Thresholds for deriveTriageVerdict.
 *
 * - `approveAt`: every required question must clear it. 0.6 on is-MCP matches
 *   the admin's own calls (Oct 2026: every reviewed listing at ≥ 0.6 approved,
 *   69 of 71 at ≤ 0.5 rejected). The others are set against how Jev actually
 *   answers them, which is far from uniform: on the first 317 pending listings
 *   belongs-in-directory never went above 0.53 and is-substantive sat near
 *   0.5 even where is-MCP was high, so the first cut (0.6 everywhere)
 *   approved none. These bars approve ~20% of that set, in line with the
 *   admin's historical approval rate; the gates stay in shadow to confirm.
 *   On 2026-10-21 the is-MCP, usable and belongs wording changed to count a
 *   product that ships an MCP server (not only a standalone one) and paid or
 *   OAuth endpoints, and pending listings started getting their README. Both
 *   shift how Jev answers, so re-check these bars against the shadow gates'
 *   agreement with admin decisions.
 *   Usability is a softer bar because a thin README often hides a real
 *   install path.
 * - `rejectBelow`: one hard question confidently answered no. Same floor as
 *   MCP_SERVER_NOUL_FLOOR (curated lists scored 0.02, real servers ≥ 0.36).
 *   Acting on a reject also needs mcpProbability < JEV_REJECT_MCP_CEILING
 *   (lib/staleness.ts), so a reject on substance alone only ever reaches a
 *   human.
 */
const TRIAGE_THRESHOLDS = {
  approveAt: {
    isMcpServer: 0.6,
    isSubstantive: 0.4,
    isUsable: 0.5,
    isLegitimate: 0.5,
    belongsInDirectory: 0.3,
  },
  rejectBelow: {
    isMcpServer: MCP_SERVER_NOUL_FLOOR,
    isSubstantive: 0.15,
    isLegitimate: 0.15,
    belongsInDirectory: 0.15,
  },
} as const;

type MatrixKey = keyof TriageMatrix;

/**
 * The verdict the matrix supports, before hard evidence (settleVerdict), and
 * how firmly: for approve the weakest required probability, for reject how
 * sure the strongest "no" is, for needs_review the overall belongs answer.
 * Null when the is-MCP answer itself is missing.
 */
export function deriveTriageVerdict(m: TriageMatrix): {
  verdict: TriageVerdict;
  confidence: number | null;
} | null {
  if (m.isMcpServer === null) return null;

  const rejecting: number[] = [];
  for (const [k, floor] of Object.entries(TRIAGE_THRESHOLDS.rejectBelow) as [
    MatrixKey,
    number,
  ][]) {
    const p = m[k];
    if (p !== null && p < floor) rejecting.push(p);
  }
  if (rejecting.length > 0) {
    return { verdict: 'reject', confidence: 1 - Math.min(...rejecting) };
  }

  const required = (
    Object.entries(TRIAGE_THRESHOLDS.approveAt) as [MatrixKey, number][]
  ).map(([k, bar]) => ({ p: m[k], bar }));
  if (required.every(({ p, bar }) => p !== null && p >= bar)) {
    return {
      verdict: 'approve',
      confidence: Math.min(...required.map(({ p }) => p as number)),
    };
  }
  return { verdict: 'needs_review', confidence: m.belongsInDirectory };
}

/** Hard evidence handed to Jev alongside the listing text, and echoed back in the reason. */
export type TriageEvidence = {
  sandboxStatus?: string | null;
  toolCount?: number | null;
  /** Tool names we already know (live handshake or README), for context. */
  toolNames?: string[];
  githubStars?: number | null;
  npmDownloads?: number | null;
  lastCommitAt?: Date | null;
  repoForkOf?: string | null;
  staleReasons?: string[];
  /** Our generated overview of the README (servers.aiOverview). */
  readme?: string | null;
  /** Our own check of the source URL (lib/repoCheck.ts). */
  repoStatus?: RepoStatus | null;
  websiteUrl?: string | null;
  installKind?: string | null;
  installCommand?: string | null;
  installPackage?: string | null;
  remoteEndpointUrl?: string | null;
};

/** Names from a servers.tools JSON column, capped so the request stays small. */
export function toolNamesFromJson(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => (typeof t?.name === 'string' ? t.name : null))
      .filter((n): n is string => Boolean(n))
      .slice(0, 30);
  } catch {
    return [];
  }
}

export type ListingTriage = ListingReview & {
  verdict: TriageVerdict | null;
  /** How firmly the matrix supports `verdict` (see deriveTriageVerdict), or null. */
  verdictConfidence: number | null;
  reason: string | null;
  matrix: TriageMatrix | null;
};

function noulOrNull(a: { noul?: number } | undefined): number | null {
  return typeof a?.noul === 'number' ? a.noul : null;
}

/** README text handed to Jev for triage, capped like the rest of the request. */
const TRIAGE_README_CHARS = 3000;

/**
 * The README Jev should read for a triage. Pending listings have no
 * aiOverview yet (that is written on enrichment, after approval), so without
 * this Jev judged them from a one-line description and scored real servers
 * as "usable 5%". Falls back to the repo's README for GitHub listings. Never
 * throws; null when there is nothing to read.
 */
export async function triageReadme(
  url: string | null | undefined,
  aiOverview: string | null | undefined,
  token?: string | null,
  fetchReadme: typeof fetchGithubReadme = fetchGithubReadme,
): Promise<string | null> {
  if (aiOverview?.trim()) return aiOverview;
  const slug = githubRepoSlug(url);
  if (!slug) return null;
  const [owner, repo] = slug.split('/');
  try {
    const readme = await fetchReadme(owner, repo, token);
    return readme ? readme.slice(0, TRIAGE_README_CHARS) : null;
  } catch {
    return null;
  }
}

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
    matrix: null,
  };
  if (!listing.name && !listing.description) return empty;

  const res = await askJev(
    {
      name: listing.name ?? '',
      description: listing.description ?? '',
      url: listing.url ?? '',
      website: evidence.websiteUrl ?? null,
      overview: (evidence.readme ?? '').slice(0, 3000),
      evidence: {
        sandbox_result: evidence.sandboxStatus ?? 'not tested',
        tools_found: evidence.toolCount ?? 0,
        tool_names: evidence.toolNames ?? [],
        install: {
          kind: evidence.installKind ?? null,
          command: evidence.installCommand ?? null,
          package: evidence.installPackage ?? null,
          hosted_endpoint: evidence.remoteEndpointUrl ?? null,
        },
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
      is_substantive: isSubstantiveQuestion,
      is_usable: isUsableQuestion,
      is_legitimate: isLegitimateQuestion,
      belongs_in_directory: belongsInDirectoryQuestion,
    },
  );
  if (!res) return empty;

  const a = res.answers;
  const review: ListingReview = {
    isMcpServer: noulVerdict(a.is_mcp_server, MCP_SERVER_NOUL_FLOOR),
    mcpServerProbability: noulOrNull(a.is_mcp_server),
    qualityScore:
      typeof a.listing_quality?.score === 'number'
        ? a.listing_quality.score
        : null,
    reviewed: true,
  };
  const matrix: TriageMatrix = {
    isMcpServer: review.mcpServerProbability,
    isSubstantive: noulOrNull(a.is_substantive),
    isUsable: noulOrNull(a.is_usable),
    isLegitimate: noulOrNull(a.is_legitimate),
    belongsInDirectory: noulOrNull(a.belongs_in_directory),
  };
  const derived = deriveTriageVerdict(matrix);
  const verdict = settleVerdict(derived?.verdict ?? null, evidence);
  return {
    ...review,
    verdict,
    verdictConfidence: derived?.confidence ?? null,
    reason: verdict ? explainTriage(verdict, review, evidence, matrix) : null,
    matrix,
  };
}

/**
 * Apply hard evidence on top of the matrix. A completed sandbox handshake is
 * proof, so it can never be auto-rejected; a source URL that returns 404 is a
 * fact, not a judgment, so it rejects unless the server was proven to run.
 */
export function settleVerdict(
  raw: TriageVerdict | null,
  evidence: TriageEvidence,
): TriageVerdict | null {
  if (raw === null) return null;
  const proven =
    evidence.sandboxStatus === 'ok' ||
    evidence.sandboxStatus === 'needs_credentials';
  if (evidence.repoStatus === 'gone') return proven ? 'needs_review' : 'reject';
  if (raw === 'reject' && proven) return 'needs_review';
  return raw;
}

const MATRIX_LABELS: Record<Exclude<MatrixKey, 'isMcpServer'>, string> = {
  isSubstantive: 'real project',
  isUsable: 'usable',
  isLegitimate: 'legit',
  belongsInDirectory: 'belongs',
};

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Human-readable one-liner for the admin card, built from facts, not model prose. */
export function explainTriage(
  verdict: TriageVerdict,
  review: ListingReview,
  evidence: TriageEvidence,
  matrix?: TriageMatrix | null,
): string {
  const parts: string[] = [];
  if (review.mcpServerProbability !== null)
    parts.push(`MCP ${pct(review.mcpServerProbability)}`);
  if (matrix) {
    for (const [k, label] of Object.entries(MATRIX_LABELS) as [
      keyof typeof MATRIX_LABELS,
      string,
    ][]) {
      const p = matrix[k];
      if (p !== null) parts.push(`${label} ${pct(p)}`);
    }
  }
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
