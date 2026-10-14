import { githubRepoSlug } from './repoUrl';

/**
 * Many GitHub repos in one GraphQL request, for the health cron.
 *
 * The REST path cost one API call per listing plus a raw README download every
 * pass, which held the cron to 50 listings per 15 minutes (a full catalog
 * pass took more than a week). One GraphQL query answers ~50 repos for about
 * one rate-limit point, and returns the README's git blob id: a content hash,
 * so the README itself is only downloaded when it actually changed.
 */

export type RepoSnapshot =
  | {
      kind: 'ok';
      stars: number;
      pushedAt: Date | null;
      archived: boolean;
      /** owner/repo of the parent when this repo is a fork, 'unknown' when GitHub hides it, null when not a fork. */
      forkOf: string | null;
      latestReleaseTag: string | null;
      /** Git blob id of the README at HEAD, null when there is none. */
      readmeOid: string | null;
      /** Path of the README the oid belongs to, for fetching its text. */
      readmePath: string | null;
    }
  /** GitHub answered: no such repo (deleted, private, or never existed). */
  | { kind: 'missing' }
  /** No answer worth acting on (rate limit, outage, auth). Keep the last verdict. */
  | { kind: 'error' };

/** Repos per GraphQL request — keeps responses small and well under node limits. */
const GITHUB_BATCH_SIZE = 50;

const README_PATHS = [
  'README.md',
  'readme.md',
  'Readme.md',
  'README.MD',
  'README.markdown',
  'README.rst',
  'README',
];
const SAFE_SEGMENT = /^[A-Za-z0-9_.-]+$/;

const REPO_FIELDS = `stargazerCount pushedAt isArchived isDisabled isFork
  parent { nameWithOwner }
  latestRelease { tagName }
  ${README_PATHS.map(
    (p, i) => `rm${i}: object(expression: "HEAD:${p}") { ... on Blob { oid } }`,
  ).join('\n  ')}`;

/** The GraphQL document for `slugs` (owner/repo), aliased r0…rN in order. */
export function buildRepoBatchQuery(slugs: string[]): string {
  const parts = slugs.map((slug, i) => {
    const [owner, name] = slug.split('/');
    return `r${i}: repository(owner: "${owner}", name: "${name}") { ${REPO_FIELDS} }`;
  });
  return `query {\n${parts.join('\n')}\n}`;
}

type RepoNode = {
  stargazerCount?: number;
  pushedAt?: string | null;
  isArchived?: boolean;
  isDisabled?: boolean;
  isFork?: boolean;
  parent?: { nameWithOwner?: string } | null;
  latestRelease?: { tagName?: string } | null;
} & Record<string, unknown>;

/** Map a GraphQL response back onto `slugs` in order. Pure, for tests. */
export function parseRepoBatchResponse(
  slugs: string[],
  body: unknown,
): RepoSnapshot[] {
  const b = body as {
    data?: Record<string, RepoNode | null> | null;
    errors?: { type?: string; path?: (string | number)[] }[];
  };
  const errorType = new Map<string, string>();
  for (const e of b?.errors ?? []) {
    const alias = e.path?.[0];
    if (typeof alias === 'string') errorType.set(alias, e.type ?? 'UNKNOWN');
  }
  return slugs.map((_, i): RepoSnapshot => {
    const alias = `r${i}`;
    const node = b?.data?.[alias];
    if (!node) {
      return errorType.get(alias) === 'NOT_FOUND'
        ? { kind: 'missing' }
        : { kind: 'error' };
    }
    let readmeOid: string | null = null;
    let readmePath: string | null = null;
    for (let j = 0; j < README_PATHS.length; j++) {
      const blob = node[`rm${j}`] as { oid?: string } | null | undefined;
      if (blob?.oid) {
        readmeOid = blob.oid;
        readmePath = README_PATHS[j];
        break;
      }
    }
    const pushed = node.pushedAt ? new Date(node.pushedAt) : null;
    return {
      kind: 'ok',
      stars: node.stargazerCount ?? 0,
      pushedAt: pushed && !Number.isNaN(pushed.getTime()) ? pushed : null,
      archived: Boolean(node.isArchived || node.isDisabled),
      forkOf: node.isFork ? (node.parent?.nameWithOwner ?? 'unknown') : null,
      latestReleaseTag: node.latestRelease?.tagName ?? null,
      readmeOid,
      readmePath,
    };
  });
}

/**
 * owner/repo for a listing URL when it is safe to put in a GraphQL string,
 * else null (the caller falls back to the REST path or skips GitHub).
 */
export function batchableRepoSlug(
  url: string | null | undefined,
): string | null {
  const slug = githubRepoSlug(url);
  if (!slug) return null;
  const [owner, name] = slug.split('/');
  return SAFE_SEGMENT.test(owner) && SAFE_SEGMENT.test(name) ? slug : null;
}

/** Fetch snapshots for `slugs`, GITHUB_BATCH_SIZE per request. Never throws. */
export async function fetchRepoSnapshots(
  slugs: string[],
  token: string,
): Promise<Map<string, RepoSnapshot>> {
  const out = new Map<string, RepoSnapshot>();
  for (let i = 0; i < slugs.length; i += GITHUB_BATCH_SIZE) {
    const chunk = slugs.slice(i, i + GITHUB_BATCH_SIZE);
    let snapshots: RepoSnapshot[];
    try {
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AllMCPs-Health-Checker',
        },
        body: JSON.stringify({ query: buildRepoBatchQuery(chunk) }),
        signal: AbortSignal.timeout(20000),
      });
      snapshots = res.ok
        ? parseRepoBatchResponse(chunk, await res.json())
        : chunk.map(() => ({ kind: 'error' }) as const);
    } catch {
      snapshots = chunk.map(() => ({ kind: 'error' }) as const);
    }
    chunk.forEach((slug, j) => {
      out.set(slug, snapshots[j]);
    });
  }
  return out;
}

/**
 * One repo over REST, for when no token is configured (GraphQL needs one).
 * Two calls instead of a fiftieth of one, so only a fallback. The README's
 * `sha` is the same git blob id GraphQL returns, so hashes stay comparable.
 */
export async function fetchRepoSnapshotRest(
  slug: string,
  headers: Record<string, string>,
): Promise<RepoSnapshot> {
  try {
    const res = await fetch(`https://api.github.com/repos/${slug}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404) return { kind: 'missing' };
    if (!res.ok) return { kind: 'error' };
    const repo = (await res.json()) as {
      stargazers_count?: number;
      pushed_at?: string;
      archived?: boolean;
      disabled?: boolean;
      fork?: boolean;
      parent?: { full_name?: string };
    };
    let readmeOid: string | null = null;
    let readmePath: string | null = null;
    const rm = await fetch(`https://api.github.com/repos/${slug}/readme`, {
      headers,
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (rm?.ok) {
      const meta = (await rm.json()) as { sha?: string; path?: string };
      readmeOid = meta.sha ?? null;
      readmePath = meta.path ?? null;
    }
    const pushed = repo.pushed_at ? new Date(repo.pushed_at) : null;
    return {
      kind: 'ok',
      stars: repo.stargazers_count ?? 0,
      pushedAt: pushed && !Number.isNaN(pushed.getTime()) ? pushed : null,
      archived: Boolean(repo.archived || repo.disabled),
      forkOf: repo.fork ? (repo.parent?.full_name ?? 'unknown') : null,
      latestReleaseTag: null,
      readmeOid,
      readmePath,
    };
  } catch {
    return { kind: 'error' };
  }
}
