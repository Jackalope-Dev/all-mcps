import { parseGithubUrl } from './repoUrl';

/** Schemes and forms that never resolve against our own domain. */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Resolves a link or image source from a listing's README or writeup against
 * the listing's source repository.
 *
 * A relative link left as is resolves against allmcps.com: `docs/x.md` on
 * /mcp/<id> becomes /mcp/docs/x.md, and Search Console reported hundreds of
 * these as 404s. So relative targets go to the repository instead, resolved
 * from the README's own folder (a monorepo deep link like
 * github.com/o/r/tree/main/src/x reads src/x/README.md), on the `HEAD` ref so
 * `main` and `master` both work. Images get raw.githubusercontent.com URLs.
 *
 * Returns the target unchanged for anchors and absolute URLs (github.com blob
 * images become raw URLs), and null when a relative target can't be resolved:
 * no GitHub repository, or a path that climbs out of the repository. Callers
 * render a null link as plain text and drop a null image.
 */
export function resolveRepoLink(
  target: unknown,
  repoUrl: string | null | undefined,
  isImage = false,
): string | null {
  if (typeof target !== 'string') return null;
  const url = target.trim();
  if (!url) return null;
  if (url.startsWith('#')) return url;
  if (ABSOLUTE.test(url)) return isImage ? rawGithubImage(url) : url;

  const gh = repoUrl ? parseGithubUrl(repoUrl) : null;
  if (!gh) return null;

  const suffixAt = url.search(/[?#]/);
  const pathPart = suffixAt === -1 ? url : url.slice(0, suffixAt);
  const suffix = suffixAt === -1 ? '' : url.slice(suffixAt);
  const base = pathPart.startsWith('/') || !gh.path ? [] : gh.path.split('/');
  const path = normalizePath(base, pathPart);
  if (path === null) return null;

  return isImage
    ? `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/HEAD/${path}${suffix}`
    : `https://github.com/${gh.owner}/${gh.repo}/blob/HEAD/${path}${suffix}`;
}

/** Joins a relative path onto a folder, or null if it climbs above the root. */
function normalizePath(base: string[], relative: string): string | null {
  const parts = [...base];
  const segments = relative.split('/');
  for (const [i, segment] of segments.entries()) {
    if (segment === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else if (segment !== '.' && segment !== '') {
      parts.push(segment);
    } else if (segment === '' && i === segments.length - 1 && i > 0) {
      // Keep a trailing slash: it marks a folder.
      parts.push('');
    }
  }
  const joined = parts.join('/');
  return joined.replace(/\/$/, '') ? joined : null;
}

/** github.com/o/r/blob/<ref>/img.png serves an HTML page, not the image. */
function rawGithubImage(url: string): string {
  try {
    const parsed = new URL(url.startsWith('//') ? `https:${url}` : url);
    if (
      (parsed.hostname === 'github.com' ||
        parsed.hostname === 'www.github.com') &&
      parsed.pathname.includes('/blob/')
    ) {
      parsed.hostname = 'raw.githubusercontent.com';
      parsed.pathname = parsed.pathname.replace('/blob/', '/');
      return parsed.toString();
    }
  } catch {
    // Not a parseable URL: leave it as written.
  }
  return url;
}
