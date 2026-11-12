import type { drizzle } from 'drizzle-orm/d1';
import { reports } from '../db/schema';
import { DEFAULT_SUBMIT_CATEGORY, normalizeCategory } from './categories';
import { classifyCategory } from './categoryClassifier';
import { endpointClaimedElsewhere } from './endpointOwnership';
import { getGithubToken, githubApiHeaders } from './githubAuth';
import { policyFlags } from './listingPolicy';
import { alignListings, reviewColumns, reviewListing } from './listingReview';
import { introspectToolsJson } from './mcpIntrospect';
import { isPlaceholderUrl } from './placeholderUrl';
import { isRepositoryUrl } from './repoUrl';
import { isWithdrawn, REJECTED_STATUS } from './servability';
import {
  isAuthType,
  isMaintenanceStatus,
  isPricingModel,
  normalizeCompatibleClients,
  normalizeTags,
} from './serverEnums';
import {
  checkEndpoint,
  discoverRemoteEndpoint,
} from './tools/discoverRemoteEndpoint';
import {
  type ExistingListingMatch,
  findExistingListingByUrl,
  findNearDuplicateCandidates,
  normalizeNameSiteKey,
} from './urlDedup';
import { isSafeSubmissionUrl, normalizeUrl } from './urlSafety';

/**
 * Shared intake for BOTH submission entry points — the human `/api/submit`
 * form and `submitListing()` (which backs `/api/v1/submit` and the
 * `submit_mcp_server` MCP tool).
 *
 * These two had drifted into near-copies that disagreed on things that
 * mattered: only the human path deduped (so an agent could create a second row
 * for a server already listed just by varying the name), only the human path
 * accepted `remoteEndpointUrl`, and both fetched GitHub unauthenticated. A
 * substring bug once had to be fixed in both files independently.
 *
 * Everything up to the insert lives here. Rate limiting, CAPTCHA, emails and
 * response shape stay with each caller, because those legitimately differ.
 */

/**
 * Owner-supplied install hint cap. Matches the dashboard edit schema so a
 * submitted value is never longer than its owner is later allowed to edit.
 */
export const SUGGESTED_INSTALL_COMMAND_MAX = 80;

export type ListingIntakeInput = {
  url?: string | null;
  websiteUrl?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  email: string;
  tags?: string[];
  pricingModel?: string | null;
  pricingNotes?: string | null;
  authType?: string | null;
  license?: string | null;
  compatibleClients?: string[];
  maintenanceStatus?: string | null;
  supportUrl?: string | null;
  remoteEndpointUrl?: string | null;
  suggestedInstallCommand?: string | null;
  suggestedInstallArgs?: string[];
};

export type ListingIntakeFailure = {
  ok: false;
  status: number;
  body: {
    error: string;
    duplicate?: true;
    existing?: ExistingListingMatch;
  };
};

export type ListingIntakeReady = {
  ok: true;
  id: string;
  name: string;
  url: string;
  websiteUrl: string;
  category: string;
  /** Ready to hand straight to `db.insert(servers).values(...)`. */
  values: Record<string, unknown>;
  /** Jev review for the listing_signals row, written after the insert succeeds. Empty when Jev did not answer. */
  signals: ReturnType<typeof reviewColumns>;
  /** A listing this may duplicate. Not certain, so it was not refused. */
  similar: ExistingListingMatch | null;
};

/**
 * Authenticated repo lookup used to fill gaps the submitter left blank.
 *
 * Previously both paths called api.github.com with only a User-Agent. That is
 * GitHub's 60-req/hour unauthenticated tier, keyed on client IP — and Workers
 * share egress IPs, so in production this was rate-limited far more often than
 * not. The failure was invisible (the catch only logged), so submitters
 * silently got thin listings, or were told the name could not be auto-filled.
 */
export async function enrichFromGitHub(
  fields: {
    url: string;
    name: string;
    description: string;
    websiteUrl: string;
  },
  env?: unknown,
): Promise<{ name: string; description: string; websiteUrl: string }> {
  let { name, description, websiteUrl } = fields;

  const githubMatch = fields.url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!githubMatch) return { name, description, websiteUrl };

  const owner = githubMatch[1];
  let repo = githubMatch[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubApiHeaders(
        getGithubToken(env),
        undefined,
        'AllMCPs-Directory',
      ),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (!name && data.name) name = String(data.name);
      if (!description && data.description) {
        description = String(data.description);
      }
      if (
        !websiteUrl &&
        data.homepage &&
        isSafeSubmissionUrl(data.homepage) &&
        !isPlaceholderUrl(data.homepage)
      ) {
        websiteUrl = String(data.homepage);
      }
    }
  } catch {
    // Best-effort: a submission must never fail because GitHub is slow or down.
  }

  return { name, description, websiteUrl };
}

/** Slug/primary key. Cloudflare Vectorize caps vector IDs (this slug) at 64 bytes. */
export function buildListingSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
      .replace(/-+$/, '') || `mcp-${Date.now()}`
  );
}

/**
 * The first existing listing Jev thinks is (or may be) the same project, or,
 * with Jev down, the one with the same name and website.
 */
export async function findSimilarListing(
  db: ReturnType<typeof drizzle>,
  submitted: {
    url: string;
    name: string;
    description: string;
    websiteUrl: string;
  },
): Promise<ExistingListingMatch | null> {
  const near = await findNearDuplicateCandidates(db, submitted);
  const submittedNameSite = normalizeNameSiteKey(
    submitted.name,
    submitted.websiteUrl,
  );
  for (const candidate of near) {
    const alignment = await alignListings(submitted, {
      name: candidate.name,
      description: candidate.description,
      url: candidate.url,
    });
    if (alignment === 'same' || alignment === 'needs_review') return candidate;
    if (alignment === 'different') continue;
    // Jev down: only the name+site match, not a fuzzy name match.
    if (
      submittedNameSite &&
      submittedNameSite ===
        normalizeNameSiteKey(candidate.name, candidate.websiteUrl)
    )
      return candidate;
  }
  return null;
}

/**
 * Files the intake's near match as an open duplicate report for admin →
 * Reports, in the weekly sweep's format so the sweep sees the pair as reported.
 * Best-effort: the listing is already in.
 */
export async function fileSimilarListingReport(
  db: ReturnType<typeof drizzle>,
  id: string,
  similar: ExistingListingMatch,
): Promise<void> {
  await db
    .insert(reports)
    .values({
      serverId: id,
      reason: 'duplicate',
      details: `Intake: possible duplicate of /mcp/${similar.id} (${similar.url ?? similar.name}). Submitted anyway because a near match is not certain. Merge it in /admin if it is the same project, or dismiss if they differ.`,
      status: 'open',
      createdAt: new Date(),
    })
    .catch((e) => console.error('Failed to file similar-listing report:', e));
}

/** The near match a submitter may see: only a live listing has a page to claim. */
export function publicSimilarListing(
  similar: ExistingListingMatch | null,
): { id: string; name: string } | null {
  return similar?.status === 'active'
    ? { id: similar.id, name: similar.name }
    : null;
}

export async function prepareListingIntake(
  input: ListingIntakeInput,
  db: ReturnType<typeof drizzle>,
  env?: unknown,
): Promise<ListingIntakeReady | ListingIntakeFailure> {
  const email = input.email.trim().toLowerCase();
  let name = (input.name || '').trim();
  let description = (input.description || '').trim();
  const category = normalizeCategory(input.category || undefined);

  let url = normalizeUrl(input.url || '');
  let websiteUrl = normalizeUrl(input.websiteUrl || '');
  // A sample-config host (`https://example.com`) is no website; drop it.
  if (isPlaceholderUrl(websiteUrl)) websiteUrl = '';

  // Website-only submissions promote the website to the primary url; a primary
  // url that is not a repo doubles as the website so the listing still renders
  // a correctly-labelled outbound link.
  if (!url && websiteUrl) url = websiteUrl;
  if (!websiteUrl && url && !isRepositoryUrl(url)) websiteUrl = url;

  if (!url) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Provide a repository URL and/or website URL.' },
    };
  }
  if (!isSafeSubmissionUrl(url)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Primary URL must be a public http(s) address.' },
    };
  }
  if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Website URL must be a public http(s) address.' },
    };
  }

  ({ name, description, websiteUrl } = await enrichFromGitHub(
    { url, name, description, websiteUrl },
    env,
  ));

  if (!name) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Name could not be auto-filled, please provide it manually.',
      },
    };
  }

  // Supplementary links: drop silently if unsafe rather than failing the whole
  // submission over a secondary field.
  let supportUrl = normalizeUrl(input.supportUrl || '');
  if (supportUrl && !isSafeSubmissionUrl(supportUrl)) supportUrl = '';
  let remoteEndpointUrl = normalizeUrl(input.remoteEndpointUrl || '');
  if (
    remoteEndpointUrl &&
    (!isSafeSubmissionUrl(remoteEndpointUrl) ||
      isPlaceholderUrl(remoteEndpointUrl))
  ) {
    remoteEndpointUrl = '';
  }

  // Both dedupe passes run for every entry point. The URL check catches a
  // straight re-submit; the name+website check catches a project that moved
  // orgs, which the URL check cannot see.
  const existingByUrl = await findExistingListingByUrl(db, url);
  if (existingByUrl) {
    return {
      ok: false,
      status: 409,
      body: {
        error: isWithdrawn(existingByUrl)
          ? `"${existingByUrl.name}" was withdrawn from the directory at its owner's request and can't be listed again.`
          : existingByUrl.status === REJECTED_STATUS
            ? `"${existingByUrl.name}" was submitted before and needs changes. If you submitted it, sign in at /dashboard with the same email to edit and resubmit it.`
            : `This server is already listed as "${existingByUrl.name}" (${existingByUrl.status}). Visit /mcp/${existingByUrl.id} to view or claim it instead of submitting a duplicate.`,
        duplicate: true,
        existing: existingByUrl,
      },
    };
  }

  // A near match is a guess (another org's wrapper for the same product, a
  // fork, a rename), so it never blocks: the submission goes in and the match
  // goes to the admin as a duplicate report (fileSimilarListingReport). Only the
  // exact URL match above is certain enough to refuse.
  const similar = await findSimilarListing(db, {
    url,
    name,
    description,
    websiteUrl,
  });

  const tags = normalizeTags(input.tags);
  const compatibleClients = normalizeCompatibleClients(input.compatibleClients);
  const suggestedInstallArgs = (input.suggestedInstallArgs || [])
    .filter((a) => typeof a === 'string' && a.trim())
    .map((a) => a.trim())
    .slice(0, 20);

  const id = buildListingSlug(name);

  let resolvedCategory = category;
  if (resolvedCategory === DEFAULT_SUBMIT_CATEGORY) {
    const classified = await classifyCategory(
      { name, description, url },
      resolvedCategory,
    );
    if (classified.fromJev) resolvedCategory = classified.category;
  }

  // Runs alongside the review: the review only reads text, and a hosted server
  // submitted by its homepage rarely says "MCP" in a way it can see.
  // A submitted endpoint is checked the same way, so the automation gate can
  // count it as proof the server runs (lib/autoDecision.ts).
  const submittedEndpoint = remoteEndpointUrl;
  const discover = () =>
    discoverRemoteEndpoint({
      url,
      websiteUrl,
      description,
      isClaimedElsewhere: endpointClaimedElsewhere(db),
    });
  const [review, endpoint] = await Promise.all([
    reviewListing({ name, description, url }),
    // A submitted endpoint that doesn't answer (a typo, pasted page text, an
    // old path) falls back to discovery instead of being the last word.
    submittedEndpoint
      ? checkEndpoint(submittedEndpoint).then((c) =>
          c.live
            ? { url: submittedEndpoint, authType: c.authType }
            : discover(),
        )
      : discover(),
  ]);
  if (endpoint) remoteEndpointUrl = endpoint.url;
  // An open endpoint's tool names, so the brochure check can see them before
  // anyone reviews it (lib/listingPolicy.ts).
  const toolsJson = endpoint ? await introspectToolsJson(endpoint.url) : null;
  // A live endpoint answering the MCP handshake outranks a text guess that
  // this isn't an MCP server.
  // Policy flags (adult content, lead-gen pages, evasion tools, directory
  // links, see lib/listingPolicy.ts) sort it to the top of the admin queue;
  // the automation gate holds it for a human.
  const reviewFlagged =
    (review.reviewed && review.isMcpServer === false && !endpoint) ||
    (review.qualityScore !== null && review.qualityScore < 2) ||
    policyFlags({ name, description, url, websiteUrl, tools: toolsJson })
      .length > 0;

  return {
    ok: true,
    id,
    name,
    url,
    websiteUrl,
    category: resolvedCategory,
    signals: reviewColumns(review),
    similar,
    values: {
      id,
      name,
      url,
      description: description || 'No description provided.',
      category: resolvedCategory,
      websiteUrl: websiteUrl || null,
      submitterEmail: email,
      isPremium: false,
      websiteVerified: false,
      isOfficial: false,
      reviewPriority: false,
      reviewFlagged,
      premiumStatus: 'free',
      status: 'pending',
      createdAt: new Date(),
      tags: tags.length ? JSON.stringify(tags) : null,
      pricingModel: isPricingModel(input.pricingModel)
        ? input.pricingModel
        : null,
      pricingNotes: (input.pricingNotes || '').trim().slice(0, 280) || null,
      authType: isAuthType(input.authType)
        ? input.authType
        : (endpoint?.authType ?? null),
      license: (input.license || '').trim().slice(0, 60) || null,
      compatibleClients: compatibleClients.length
        ? JSON.stringify(compatibleClients)
        : null,
      maintenanceStatus: isMaintenanceStatus(input.maintenanceStatus)
        ? input.maintenanceStatus
        : null,
      supportUrl: supportUrl || null,
      remoteEndpointUrl: remoteEndpointUrl || null,
      ...(toolsJson ? { tools: toolsJson, toolsSource: 'introspected' } : {}),
      ...(endpoint
        ? {
            remoteEndpointHealthy: true,
            remoteEndpointCheckedAt: new Date(),
            remoteEndpointHealthyAt: new Date(),
          }
        : {}),
      suggestedInstallCommand:
        (input.suggestedInstallCommand || '')
          .trim()
          .slice(0, SUGGESTED_INSTALL_COMMAND_MAX) || null,
      suggestedInstallArgs: suggestedInstallArgs.length
        ? JSON.stringify(suggestedInstallArgs)
        : null,
    },
  };
}
