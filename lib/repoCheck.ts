import { githubApiHeaders } from './githubAuth';
import { isGitHubRepoUrl } from './repoUrl';

/**
 * Does the listing's source URL still exist? Our own answer, used as hard
 * evidence alongside Jev's judgment in the triage queue.
 *
 * Only 404/410/451 mean gone. A timeout, 403 (rate limit), 429 or 5xx is
 * `unknown` and changes nothing — the same rule auto-promote's liveness check
 * follows, because "gone" eventually leads to removal.
 */
export type RepoStatus = 'ok' | 'archived' | 'gone' | 'site_only' | 'unknown';
/*
 * 'site_only': the repo 404s but the listing's website is live. Common for
 * companies that publish a hosted server to the official registry from a
 * private repo (seen on most sampled pending listings, 2026-10-13: the org
 * exists, the repo 404s). Not evidence the listing is dead.
 */

const GONE_HTTP_STATUSES = new Set([404, 410, 451]);

export function classifyRepoResponse(
  status: number,
  body?: { archived?: boolean; disabled?: boolean } | null,
): RepoStatus {
  if (GONE_HTTP_STATUSES.has(status)) return 'gone';
  if (status >= 200 && status < 300) {
    return body?.archived || body?.disabled ? 'archived' : 'ok';
  }
  return 'unknown';
}

/** `owner/repo` from a GitHub URL, or null. */
export function githubRepoPath(url: string): string | null {
  if (!isGitHubRepoUrl(url)) return null;
  const m = new URL(url).pathname.match(/^\/([^/]+)\/([^/#?]+)/);
  if (!m) return null;
  return `${m[1]}/${m[2].replace(/\.git$/i, '')}`;
}

export async function checkRepo(
  url: string,
  githubToken: string | null,
  websiteUrl?: string | null,
): Promise<RepoStatus> {
  const status = await checkUrl(url, githubToken);
  if (status !== 'gone' || !websiteUrl || websiteUrl === url) return status;
  // Only call it gone when the website is gone too; an unreachable site is
  // inconclusive, not a second strike.
  const site = await checkUrl(websiteUrl, githubToken);
  if (site === 'ok' || site === 'archived') return 'site_only';
  return site === 'gone' ? 'gone' : 'unknown';
}

async function checkUrl(
  url: string,
  githubToken: string | null,
): Promise<RepoStatus> {
  try {
    const path = githubRepoPath(url);
    if (path) {
      // The API, not the HTML page: it follows renames (301 → new repo) and
      // reports archived/disabled, and a token gives 5,000 requests an hour.
      const res = await fetch(`https://api.github.com/repos/${path}`, {
        headers: githubApiHeaders(
          githubToken,
          'application/vnd.github+json',
          'AllMCPs-Repo-Check',
        ),
        signal: AbortSignal.timeout(8000),
      });
      const body = res.ok
        ? ((await res.json()) as { archived?: boolean; disabled?: boolean })
        : null;
      return classifyRepoResponse(res.status, body);
    }
    // Any other host: a plain HEAD, falling back to GET for servers that
    // reject HEAD.
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'AllMCPs-Repo-Check' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'AllMCPs-Repo-Check' },
        signal: AbortSignal.timeout(8000),
      });
    }
    return classifyRepoResponse(res.status);
  } catch {
    return 'unknown';
  }
}

/** Two "gone" answers at least this far apart before anything is acted on. */
export const REPO_GONE_CONFIRM_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a listing's source is confirmed gone: seen gone on at least two
 * checks, the first a day or more before the latest. One 404 can be a repo
 * mid-rename or briefly private; two a day apart is not.
 */
export function isRepoGoneConfirmed(
  goneCount: number | null | undefined,
  firstGoneAt: Date | null | undefined,
  now: Date,
): boolean {
  return (
    (goneCount ?? 0) >= 2 &&
    firstGoneAt != null &&
    now.getTime() - firstGoneAt.getTime() >= REPO_GONE_CONFIRM_MS
  );
}
