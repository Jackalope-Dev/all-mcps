/**
 * Resolves relative URLs (e.g. `assets/logo.png`, `./LICENSE`) against a repository URL.
 */
export function resolveUrl(
  url: string | Blob | undefined,
  repoUrl?: string,
  isImage?: boolean,
): string {
  if (!url || typeof url !== 'string') return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//') ||
    url.startsWith('data:') ||
    url.startsWith('#') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:')
  ) {
    if (isImage) {
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
        // fallback
      }
    }
    return url;
  }

  if (!repoUrl) return url;

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) return url;

  const owner = match[1];
  let repo = match[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  const cleanPath = url.replace(/^\.\//, '').replace(/^\//, '');

  if (isImage) {
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/${cleanPath}`;
  }
  return `https://github.com/${owner}/${repo}/blob/main/${cleanPath}`;
}
