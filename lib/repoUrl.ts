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

/** GitHub paths that look like owner/repo but are site pages, not repositories. */
const NOT_A_REPO_OWNER = new Set([
  'sponsors',
  'orgs',
  'topics',
  'marketplace',
  'apps',
  'settings',
  'features',
  'about',
]);

/**
 * Lowercased `owner/repo` for any GitHub reference a registry might hold —
 * https and git+https URLs, git@github.com:owner/repo, the `github:owner/repo`
 * shorthand — or null for anything else. Deep links (/tree/main/src/x) reduce
 * to the repo, so a monorepo package and its listing compare equal.
 */
export function githubRepoSlug(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const m =
    /^github:([\w.-]+)\/([\w.-]+)/i.exec(ref.trim()) ||
    /github\.com[/:]([\w.-]+)\/([\w.-]+)/i.exec(ref);
  if (!m) return null;
  const repo = m[2].replace(/\.git$/i, '');
  if (!repo || NOT_A_REPO_OWNER.has(m[1].toLowerCase())) return null;
  return `${m[1]}/${repo}`.toLowerCase();
}

/**
 * Whether an install package's registry repo and the listing's repo point at
 * different projects. Renames inside one owner, transfers that keep the repo
 * name, and a listing that is a fork of the package's repo all happen to
 * honest packages, so only a different owner *and* a different repo name
 * counts.
 */
export function isPackageRepoMismatch(
  packageRepo: string | null | undefined,
  listingRepo: string | null | undefined,
  listingForkOf?: string | null,
): boolean {
  if (!packageRepo || !listingRepo || packageRepo === listingRepo) return false;
  if (packageRepo === listingForkOf?.toLowerCase()) return false;
  const [pkgOwner, pkgName] = packageRepo.split('/');
  const [listOwner, listName] = listingRepo.split('/');
  return pkgOwner !== listOwner && pkgName !== listName;
}

/**
 * Owner and repo of a GitHub URL, plus the branch and folder when it deep-links
 * into a monorepo (github.com/o/r/tree/main/src/filesystem → ref "main", path
 * "src/filesystem"). A blob link to a file resolves to the file's folder.
 */
export function parseGithubUrl(
  url: string,
): { owner: string; repo: string; ref?: string; path?: string } | null {
  const m = (url || '').match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  let repo = m[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);
  const deep = (url || '').match(
    /github\.com\/[^/]+\/[^/#?]+\/(tree|blob)\/([^/#?]+)\/([^#?]+)/i,
  );
  if (!deep) return { owner: m[1], repo };
  let path = deep[3].replace(/\/+$/, '');
  // blob/<ref>/dir/README.md → the folder holding that file.
  if (deep[1].toLowerCase() === 'blob' && /\.[a-z0-9]+$/i.test(path)) {
    path = path.split('/').slice(0, -1).join('/');
  }
  if (!path || !/^[\w.\-/]+$/.test(path) || path.includes('..')) {
    return { owner: m[1], repo };
  }
  return { owner: m[1], repo, ref: deep[2], path };
}

/**
 * Prefix for files inside a listing's own folder: "src/filesystem/" for a
 * monorepo deep link, "" for a whole-repo URL.
 */
export function githubFolderPrefix(url: string | null | undefined): string {
  const path = url ? parseGithubUrl(url)?.path : undefined;
  return path ? `${path}/` : '';
}
