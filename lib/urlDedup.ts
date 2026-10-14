import { type AnyColumn, and, or, type SQL, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { servers } from '../db/schema';

/**
 * Same normalization as scripts/ingest-sources.mjs's normalizeUrlKey — kept in
 * sync deliberately so "already in the catalog" means the same thing whether
 * a listing arrived via a human submission or the registry-sync ingest.
 */
export function normalizeUrlKey(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const p = u.pathname.replace(/\.git$/i, '').replace(/\/+$/, '');
    // `www.` is stripped so example.com and www.example.com are one listing.
    // normalizeNameSiteKey already did this; this key did not, so the two
    // disagreed and a plain-vs-www pair slipped past every dedupe path.
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return `${host}${p.toLowerCase()}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Canonical package-identity key (e.g. "npm:@foo/bar") — closes a gap the URL key
 * alone misses: the same npm/PyPI package can be listed under different repo or
 * marketing URLs across sources. `ecosystem` is 'npm' or 'pypi' (see
 * scripts/ingest-sources.mjs's installEcosystemFromCommand for how it's derived
 * from a cached installCommand). Ported verbatim into scripts/ingest-sources.mjs
 * for the same reason normalizeUrlKey is — that script runs as plain Node ESM,
 * not through the TS toolchain.
 */
export function normalizePackageKey(
  ecosystem: 'npm' | 'pypi' | null | undefined,
  packageName: string | null | undefined,
): string | null {
  if (!ecosystem || !packageName) return null;
  const pkg = packageName.trim().toLowerCase();
  if (!pkg || pkg.startsWith('http')) return null;
  return `${ecosystem}:${pkg}`;
}

export type ExistingListingMatch = {
  id: string;
  name: string;
  status: string;
  url?: string;
  description?: string | null;
  websiteUrl?: string | null;
};

/** Case-insensitive "contains" on a column, without LIKE's wildcard escaping. */
function containsLower(column: AnyColumn, needle: string): SQL {
  return sql`instr(lower(coalesce(${column}, '')), ${needle}) > 0`;
}

/**
 * Narrowing needles are only safe when the raw stored text must contain them.
 * An internationalized host can be stored as Unicode (müller.de) while the URL
 * parser hands back punycode (xn--mller-kva.de), and SQLite's lower() is
 * ASCII-only, so either form makes the caller scan everything instead.
 */
function isSafeNeedle(needle: string): boolean {
  return /^[!-~]*$/.test(needle) && !needle.includes('xn--');
}

/**
 * Rows that could share `key` (normalizeUrlKey) with `url`: their lowercased
 * URL must contain the key's host and its last path segment. Only the last
 * segment, because the parser rewrites stored paths (dot segments, backslashes)
 * in ways a raw substring test can't follow, while the final segment survives
 * all of them. Null when no needle is safe — the caller then scans everything.
 */
function urlKeyPrefilter(url: string): SQL | null {
  let host: string;
  let lastSegment: string;
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase().replace(/^www\./, '');
    lastSegment =
      u.pathname
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '')
        .toLowerCase()
        .split('/')
        .pop() ?? '';
  } catch {
    return null;
  }
  if (!isSafeNeedle(host)) return null;
  const safeSegment =
    lastSegment && isSafeNeedle(lastSegment) && !lastSegment.includes('%');
  return safeSegment
    ? (and(
        containsLower(servers.url, host),
        containsLower(servers.url, lastSegment),
      ) as SQL)
    : containsLower(servers.url, host);
}

/**
 * Checks whether `url` already matches an existing listing's primary URL —
 * regardless of that listing's status, so a 'removed' (dead-link) or
 * 'pending' row still counts as "already here" and blocks a duplicate
 * submission instead of silently creating a second row for the same server.
 * D1 narrows the rows by host and path first; the exact key is compared here.
 */
export async function findExistingListingByUrl(
  db: ReturnType<typeof drizzle>,
  url: string,
): Promise<ExistingListingMatch | null> {
  const key = normalizeUrlKey(url);
  const prefilter = urlKeyPrefilter(url);
  const query = db
    .select({
      id: servers.id,
      name: servers.name,
      url: servers.url,
      description: servers.description,
      websiteUrl: servers.websiteUrl,
      status: servers.status,
    })
    .from(servers);
  const rows = await (prefilter ? query.where(prefilter) : query);
  const match = rows.find((r) => normalizeUrlKey(r.url) === key);
  return match
    ? {
        id: match.id,
        name: match.name,
        status: match.status,
        url: match.url,
        description: match.description,
        websiteUrl: match.websiteUrl,
      }
    : null;
}

/**
 * Identity key for "same project, different URL" — the gap normalizeUrlKey
 * misses when one project is resubmitted under a different GitHub org or a
 * marketing URL. Only meaningful when a website is given; returns '' otherwise
 * so the caller skips the check rather than matching every website-less row.
 */
export function normalizeNameSiteKey(
  name: string | null | undefined,
  websiteUrl: string | null | undefined,
): string {
  const site = (websiteUrl ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
  if (!site) return '';
  const n = (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!n) return '';
  return `${n}|${site}`;
}

function listingNameKey(name: string | null | undefined): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && w !== 'mcp' && w !== 'server' && w !== 'servers')
    .join(' ')
    .trim();
}

function websiteHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (
      /(^|\.)github\.com$|(^|\.)github\.io$|(^|\.)gitlab\.com$|(^|\.)bitbucket\.org$/.test(
        host,
      )
    ) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

function toMatch(row: {
  id: string;
  name: string;
  status: string;
  url: string;
  description: string | null;
  websiteUrl: string | null;
}): ExistingListingMatch {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    url: row.url,
    description: row.description,
    websiteUrl: row.websiteUrl,
  };
}

/**
 * Near-duplicates that are not an exact URL match — same name+site, same
 * marketing domain, or the same stripped name. Used as Jev pair input.
 */
export async function findNearDuplicateCandidates(
  db: ReturnType<typeof drizzle>,
  input: { url: string; name: string; websiteUrl?: string | null },
): Promise<ExistingListingMatch[]> {
  const urlKey = normalizeUrlKey(input.url);
  const nameSite = normalizeNameSiteKey(input.name, input.websiteUrl);
  const nameKey = listingNameKey(input.name);
  const host = websiteHost(input.websiteUrl) || websiteHost(input.url);

  // D1 narrows to rows that could match one of the three keys below; the
  // exact comparisons still run here. A same-nameKey row contains every
  // token of nameKey in its lowercased name; a same-site row contains the
  // site (or host) in its website or URL.
  const site = nameSite ? nameSite.slice(nameSite.indexOf('|') + 1) : '';
  const clauses: SQL[] = [];
  if (nameKey) {
    clauses.push(
      and(
        ...nameKey.split(' ').map((t) => containsLower(servers.name, t)),
      ) as SQL,
    );
  }
  // An unsafe site/host needle (IDN, non-ASCII) can't narrow without missing
  // stored rows, so that case falls back to reading every row.
  const unsafeNeedle = [site, host].some((n) => n && !isSafeNeedle(n));
  for (const needle of [site, host]) {
    if (!needle) continue;
    clauses.push(
      or(
        containsLower(servers.websiteUrl, needle),
        containsLower(servers.url, needle),
      ) as SQL,
    );
  }
  if (clauses.length === 0) return [];

  const rows = await db
    .select({
      id: servers.id,
      name: servers.name,
      url: servers.url,
      description: servers.description,
      websiteUrl: servers.websiteUrl,
      status: servers.status,
    })
    .from(servers)
    .where(unsafeNeedle ? undefined : or(...clauses));

  const out: ExistingListingMatch[] = [];
  const seen = new Set<string>();
  const push = (row: (typeof rows)[number]) => {
    if (seen.has(row.id)) return;
    if (normalizeUrlKey(row.url) === urlKey) return;
    seen.add(row.id);
    out.push(toMatch(row));
  };

  if (nameSite) {
    for (const r of rows) {
      if (normalizeNameSiteKey(r.name, r.websiteUrl) === nameSite) push(r);
    }
  }
  if (host) {
    for (const r of rows) {
      if (websiteHost(r.websiteUrl) === host || websiteHost(r.url) === host) {
        push(r);
      }
    }
  }
  if (nameKey) {
    for (const r of rows) {
      if (listingNameKey(r.name) === nameKey) push(r);
    }
  }

  return out.slice(0, 3);
}
