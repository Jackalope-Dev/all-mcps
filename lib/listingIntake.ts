import type { drizzle } from 'drizzle-orm/d1';
import { DEFAULT_SUBMIT_CATEGORY, normalizeCategory } from './categories';
import { classifyCategory } from './categoryClassifier';
import { getGithubToken, githubApiHeaders } from './githubAuth';
import { alignListings, reviewListing } from './listingReview';
import { isRepositoryUrl } from './repoUrl';
import {
  isAuthType,
  isMaintenanceStatus,
  isPricingModel,
  normalizeCompatibleClients,
  normalizeTags,
} from './serverEnums';
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
      if (!websiteUrl && data.homepage && isSafeSubmissionUrl(data.homepage)) {
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
  if (remoteEndpointUrl && !isSafeSubmissionUrl(remoteEndpointUrl)) {
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
        error: `This server is already listed as "${existingByUrl.name}" (${existingByUrl.status}). Visit /mcp/${existingByUrl.id} to view or claim it instead of submitting a duplicate.`,
        duplicate: true,
        existing: existingByUrl,
      },
    };
  }

  const near = await findNearDuplicateCandidates(db, {
    url,
    name,
    websiteUrl,
  });
  const submittedNameSite = normalizeNameSiteKey(name, websiteUrl);
  for (const candidate of near) {
    const alignment = await alignListings(
      { name, description, url },
      {
        name: candidate.name,
        description: candidate.description,
        url: candidate.url,
      },
    );
    if (alignment === 'different') continue;
    if (alignment === 'same' || alignment === 'needs_review') {
      return {
        ok: false,
        status: 409,
        body: {
          error: `This server looks like "${candidate.name}" (${candidate.status}). Visit /mcp/${candidate.id} to view or claim it instead of submitting a duplicate.`,
          duplicate: true,
          existing: candidate,
        },
      };
    }
    // Jev down: only keep the pre-Jev name+site block, not a fuzzy name match.
    const candidateNameSite = normalizeNameSiteKey(
      candidate.name,
      candidate.websiteUrl,
    );
    if (
      submittedNameSite &&
      candidateNameSite &&
      submittedNameSite === candidateNameSite
    ) {
      return {
        ok: false,
        status: 409,
        body: {
          error: `This server is already listed as "${candidate.name}" (${candidate.status}). Visit /mcp/${candidate.id} to view or claim it instead of submitting a duplicate.`,
          duplicate: true,
          existing: candidate,
        },
      };
    }
  }

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

  const review = await reviewListing({ name, description, url });
  const reviewPriority =
    (review.reviewed && review.isMcpServer === false) ||
    (review.qualityScore !== null && review.qualityScore < 2);

  return {
    ok: true,
    id,
    name,
    url,
    websiteUrl,
    category: resolvedCategory,
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
      reviewPriority,
      premiumStatus: 'free',
      status: 'pending',
      createdAt: new Date(),
      tags: tags.length ? JSON.stringify(tags) : null,
      pricingModel: isPricingModel(input.pricingModel)
        ? input.pricingModel
        : null,
      pricingNotes: (input.pricingNotes || '').trim().slice(0, 280) || null,
      authType: isAuthType(input.authType) ? input.authType : null,
      license: (input.license || '').trim().slice(0, 60) || null,
      compatibleClients: compatibleClients.length
        ? JSON.stringify(compatibleClients)
        : null,
      maintenanceStatus: isMaintenanceStatus(input.maintenanceStatus)
        ? input.maintenanceStatus
        : null,
      supportUrl: supportUrl || null,
      remoteEndpointUrl: remoteEndpointUrl || null,
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
