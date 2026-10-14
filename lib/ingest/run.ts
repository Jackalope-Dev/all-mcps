import { eq, like, or } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../db/schema';
import { DEFAULT_SUBMIT_CATEGORY, normalizeCategory } from '../categories';
import { classifyCategory } from '../categoryClassifier';
import { cleanListingDescription } from '../description';
import { toCachedInstallFields } from '../installConfig';
import { fetchGithubRepo, parseGithubUrl } from '../listingEnrich';
import { buildListingSlug } from '../listingIntake';
import { alignListings } from '../listingReview';
import { registryFor } from '../packageRegistry';
import { checkRepo, classifyRepoResponse, type RepoStatus } from '../repoCheck';
import { upsertSignals } from '../signalStore';
import {
  findNearDuplicateCandidates,
  normalizeNameSiteKey,
  normalizePackageKey,
  normalizeUrlKey,
} from '../urlDedup';
import { isSafeSubmissionUrl, normalizeUrl } from '../urlSafety';
import { findRepoIdentityMismatch } from './repoIdentity';
import { type IngestCandidate, ingestRejectReason } from './sources';

type Db = ReturnType<typeof drizzle>;

export type IngestOptions = {
  now: Date;
  /** New listings to create this run; the rest wait for the next one. */
  maxNew: number;
  /** Stop starting new candidates after this epoch-ms. */
  deadline: number;
  githubToken: string | null;
};

export type IngestResult = {
  fetched: number;
  belowFloor: Record<string, number>;
  alreadyListed: number;
  inserted: number;
  flagged: number;
  sameProject: number;
  deadOnArrival: number;
  /** New candidates left for the next run (cap or deadline reached). */
  deferred: number;
};

function packageKeyOf(
  command: string | null | undefined,
  pkg: string | null | undefined,
): string | null {
  return normalizePackageKey(registryFor(command), pkg);
}

/**
 * Keys of everything already on file, any status, so a removed or pending row
 * still blocks a re-import. Three short columns rather than whole rows: this
 * is the one full read per run.
 */
async function loadExistingKeys(db: Db) {
  const rows = await db
    .select({
      url: servers.url,
      installCommand: servers.installCommand,
      installPackage: servers.installPackage,
    })
    .from(servers);
  const urlKeys = new Set<string>();
  const packageKeys = new Set<string>();
  for (const r of rows) {
    urlKeys.add(normalizeUrlKey(r.url));
    const pk = packageKeyOf(r.installCommand, r.installPackage);
    if (pk) packageKeys.add(pk);
  }
  return { urlKeys, packageKeys };
}

/**
 * Exact-key dedupe against the catalog and within the batch, plus the quality
 * floor. Pure, so the "what is new" rule is tested without a database.
 */
export function selectNewCandidates(
  candidates: IngestCandidate[],
  existing: { urlKeys: Set<string>; packageKeys: Set<string> },
): {
  fresh: IngestCandidate[];
  alreadyListed: number;
  belowFloor: Record<string, number>;
} {
  const belowFloor: Record<string, number> = {};
  const seenUrl = new Set(existing.urlKeys);
  const seenPkg = new Set(existing.packageKeys);
  const fresh: IngestCandidate[] = [];
  let alreadyListed = 0;
  for (const raw of candidates) {
    const url = normalizeUrl(raw.url);
    if (!isSafeSubmissionUrl(url)) {
      belowFloor['unsafe url'] = (belowFloor['unsafe url'] ?? 0) + 1;
      continue;
    }
    const c = { ...raw, url };
    const urlKey = normalizeUrlKey(url);
    const pkgKey = packageKeyOf(c.installCommand, c.installPackage);
    if (seenUrl.has(urlKey) || (pkgKey && seenPkg.has(pkgKey))) {
      alreadyListed++;
      continue;
    }
    const reason = ingestRejectReason(c);
    if (reason) {
      belowFloor[reason] = (belowFloor[reason] ?? 0) + 1;
      continue;
    }
    seenUrl.add(urlKey);
    if (pkgKey) seenPkg.add(pkgKey);
    fresh.push(c);
  }
  return { fresh, alreadyListed, belowFloor };
}

/** First free id for `name`: the slug, else slug-2, slug-3… */
async function freeListingId(db: Db, name: string): Promise<string> {
  const base = buildListingSlug(name);
  const taken = new Set(
    (
      await db
        .select({ id: servers.id })
        .from(servers)
        .where(or(eq(servers.id, base), like(servers.id, `${base}-%`)))
    ).map((r) => r.id),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

type SourceCheck = {
  status: RepoStatus;
  stars: number | null;
  fork: boolean;
  description: string | null;
  homepage: string | null;
};

/** One look at the source: GitHub's API for repos (stars, fork, archived), a HEAD otherwise. */
async function checkSource(
  c: IngestCandidate,
  token: string | null,
): Promise<SourceCheck> {
  const gh = parseGithubUrl(c.url);
  if (gh) {
    try {
      const res = await fetchGithubRepo(gh.owner, gh.repo, token);
      if (!res.ok) {
        return {
          status: classifyRepoResponse(res.status),
          stars: null,
          fork: false,
          description: null,
          homepage: null,
        };
      }
      const data = res.data as typeof res.data & { fork?: boolean };
      return {
        status: classifyRepoResponse(200, data),
        stars: data.stargazers_count ?? null,
        fork: Boolean(data.fork),
        description: data.description ?? null,
        homepage: data.homepage ?? null,
      };
    } catch {
      return {
        status: 'unknown',
        stars: null,
        fork: false,
        description: null,
        homepage: null,
      };
    }
  }
  const check = await checkRepo(c.url, token, c.websiteUrl);
  return {
    status: check.status,
    stars: check.stars,
    fork: false,
    description: null,
    homepage: null,
  };
}

/**
 * Near-duplicate verdict for a candidate the exact keys let through.
 * 'skip' when Jev is sure it is the same project (a duplicate only splits
 * traffic and reviews); a reason string when a human should look; null when
 * clear. Without Jev, only a corroborated match (same name+site, or same
 * website host) is flagged — a shared name alone is common and meaningless.
 */
async function nearDuplicateVerdict(
  db: Db,
  c: IngestCandidate,
): Promise<'skip' | string | null> {
  const near = await findNearDuplicateCandidates(db, {
    url: c.url,
    name: c.name,
    websiteUrl: c.websiteUrl,
  });
  let flag: string | null = null;
  for (const other of near) {
    const alignment = await alignListings(
      { name: c.name, description: c.description, url: c.url },
      { name: other.name, description: other.description, url: other.url },
    );
    if (alignment === 'same') return 'skip';
    if (alignment === 'different') continue;
    if (alignment === 'needs_review') {
      flag ??= `Jev: needs review vs '${other.id}'`;
      continue;
    }
    const sameNameSite =
      normalizeNameSiteKey(c.name, c.websiteUrl) !== '' &&
      normalizeNameSiteKey(c.name, c.websiteUrl) ===
        normalizeNameSiteKey(other.name, other.websiteUrl);
    if (sameNameSite) flag ??= `possible duplicate of '${other.id}'`;
  }
  return flag;
}

function installFieldsFor(c: IngestCandidate) {
  if (!c.installCommand || !c.installPackage) return null;
  return toCachedInstallFields({
    kind: 'stdio',
    command: c.installCommand,
    args:
      c.installCommand === 'npx'
        ? ['-y', c.installPackage]
        : [c.installPackage],
    packageName: c.installPackage,
    // The registry entry is the publisher's own declaration; an npm hit is
    // the package itself but may need a different bin or flags.
    confidence: c.source === 'official-registry' ? 'high' : 'medium',
    source: 'submitted',
  });
}

/**
 * Insert new candidates as pending, ingested listings (no submitterEmail), so
 * the stale sweep, Jev triage, the imported-listing gate and auto-promote
 * take it from there exactly as they do for the weekly script's imports.
 */
export async function ingestCandidates(
  db: Db,
  candidates: IngestCandidate[],
  opts: IngestOptions,
): Promise<IngestResult> {
  const existing = await loadExistingKeys(db);
  const { fresh, alreadyListed, belowFloor } = selectNewCandidates(
    candidates,
    existing,
  );
  const result: IngestResult = {
    fetched: candidates.length,
    belowFloor,
    alreadyListed,
    inserted: 0,
    flagged: 0,
    sameProject: 0,
    deadOnArrival: 0,
    deferred: 0,
  };

  for (let i = 0; i < fresh.length; i++) {
    if (result.inserted >= opts.maxNew || Date.now() > opts.deadline) {
      result.deferred = fresh.length - i;
      break;
    }
    const c = fresh[i];

    const source = await checkSource(c, opts.githubToken);
    if (source.status === 'gone' || source.status === 'archived') {
      result.deadOnArrival++;
      continue;
    }
    const checked: IngestCandidate = {
      ...c,
      githubStars: source.stars ?? c.githubStars,
      fork: c.fork || source.fork,
      description: c.description || source.description || '',
      websiteUrl:
        c.websiteUrl ||
        (source.homepage && isSafeSubmissionUrl(source.homepage)
          ? source.homepage
          : undefined),
    };
    const lateReason = ingestRejectReason(checked);
    if (lateReason) {
      belowFloor[lateReason] = (belowFloor[lateReason] ?? 0) + 1;
      continue;
    }

    const dup = await nearDuplicateVerdict(db, checked);
    if (dup === 'skip') {
      result.sameProject++;
      continue;
    }
    const repoMismatch = findRepoIdentityMismatch(checked);
    const reviewFlagged = Boolean(dup || repoMismatch);

    let category = normalizeCategory(checked.category);
    if (category === DEFAULT_SUBMIT_CATEGORY) {
      const classified = await classifyCategory(
        {
          name: checked.name,
          description: checked.description,
          url: checked.url,
        },
        category,
      );
      if (classified.fromJev) category = classified.category;
    }

    const install = installFieldsFor(checked);
    const remoteEndpointUrl =
      checked.remoteEndpointUrl &&
      isSafeSubmissionUrl(checked.remoteEndpointUrl)
        ? checked.remoteEndpointUrl
        : null;
    const id = await freeListingId(db, checked.name);

    try {
      await db.insert(servers).values({
        id,
        name: checked.name,
        url: checked.url,
        websiteUrl: checked.websiteUrl || null,
        description:
          cleanListingDescription(checked.description) ||
          'No description provided.',
        category,
        isOfficial: checked.url
          .toLowerCase()
          .includes('github.com/modelcontextprotocol/servers'),
        status: 'pending',
        reviewFlagged,
        githubStars: checked.githubStars ?? null,
        remoteEndpointUrl,
        createdAt: opts.now,
        ...(install ?? {}),
      });
    } catch (err) {
      // A concurrent run took the id, or a constraint we did not foresee:
      // skip this one, the next run retries it.
      console.warn(`[ingest] insert failed for ${id}:`, err);
      continue;
    }

    // The source check above is the same evidence the stale sweep's repo
    // phase gathers, so record it now: the imported-listing gate waits for
    // repoStatus before it decides, and pending rows get no health checks.
    await upsertSignals(db, id, {
      discoveredVia: checked.source,
      ...(source.status !== 'unknown'
        ? {
            repoStatus: source.status,
            repoCheckedAt: opts.now,
            repoGoneCount: 0,
          }
        : {}),
      ...(source.stars !== null ? { repoStars: source.stars } : {}),
    });

    result.inserted++;
    if (reviewFlagged) result.flagged++;
  }
  return result;
}
