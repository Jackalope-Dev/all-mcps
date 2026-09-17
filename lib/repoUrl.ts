/**
 * Is this URL actually a source repository, as opposed to a product homepage?
 *
 * `servers.url` is the primary submitted link, and for a long time the listing
 * page assumed it was always a GitHub repo — it rendered a hardcoded "View
 * Repository" button with a repo icon and github click-attribution. That's
 * wrong for the (increasingly common) listing whose source is private or
 * closed, where `url` is the vendor's own site: the page told visitors a
 * marketing page was the source repo, and duplicated the Visit Website button.
 *
 * Deliberately host-based rather than a `.includes('github.com')` substring
 * check, which matches decoys like `github.com.example.dev`.
 */
const REPO_HOSTS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'codeberg.org',
  'gitee.com',
  'git.sr.ht',
  'sourceforge.net',
  'dev.azure.com',
]);

export function isRepositoryUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!REPO_HOSTS.has(host)) return false;
    // A bare host (github.com, github.com/explore) is not a repo — a real one
    // has at least an owner and a project segment.
    return parsed.pathname.split('/').filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

/**
 * Narrower check for GitHub specifically — the README-badge claim method and
 * the health cron's repo-metadata fetch only work against github.com, so
 * "is a repo" isn't a strong enough gate for either.
 *
 * Matters most in the claim path: a substring match let a host like
 * `github.com.example.dev/owner/repo` present (and be credited for) a GitHub
 * README proof it could never actually satisfy.
 */
export function isGitHubRepoUrl(url: string | null | undefined): boolean {
  if (!isRepositoryUrl(url)) return false;
  try {
    return (
      new URL(url as string).hostname.toLowerCase().replace(/^www\./, '') ===
      'github.com'
    );
  } catch {
    return false;
  }
}
