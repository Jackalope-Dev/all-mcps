/**
 * Sites a README or registry entry links to that are almost never the
 * listing's own website: the protocol docs, a language or runtime, a license,
 * an AI client. Imports took the first such link as the "website", and by
 * Nov 2026 ~1,700 live listings showed modelcontextprotocol.io, nodejs.org,
 * python.org, claude.ai or opensource.org/licenses/MIT as their product site.
 *
 * Each host lists the GitHub owners it really does belong to, so the
 * official modelcontextprotocol/* servers keep modelcontextprotocol.io and
 * Anthropic's own keep anthropic.com. Package pages (npm, PyPI, Docker Hub)
 * are deliberately not here: those are the product's own page.
 */
const GENERIC_WEBSITE_HOSTS: Record<string, string[]> = {
  'modelcontextprotocol.io': ['modelcontextprotocol'],
  'nodejs.org': ['nodejs'],
  'python.org': ['python'],
  'typescriptlang.org': ['microsoft'],
  'rust-lang.org': ['rust-lang'],
  'go.dev': ['golang'],
  'bun.sh': ['oven-sh'],
  'deno.com': ['denoland'],
  'developer.mozilla.org': ['mdn', 'mozilla'],
  'opensource.org': [],
  'choosealicense.com': [],
  'spdx.org': [],
  'claude.ai': ['anthropics'],
  'anthropic.com': ['anthropics'],
  'openai.com': ['openai'],
  'cursor.com': ['getcursor', 'cursor'],
  'code.visualstudio.com': ['microsoft'],
  'microsoft.com': ['microsoft', 'azure', 'microsoftdocs'],
  'google.com': [
    'google',
    'googleapis',
    'google-gemini',
    'googlecloudplatform',
  ],
  'vercel.com': ['vercel', 'vercel-labs'],
  'www.docker.com': ['docker'],
  'docs.docker.com': ['docker'],
  'mcp.so': [],
};

/**
 * Store and package pages under a generic domain: a Chrome extension, an app
 * or a Go package page is the product's own page, the same as npm or PyPI.
 */
const PRODUCT_PAGE_HOSTS = new Set([
  'chromewebstore.google.com',
  'play.google.com',
  'apps.microsoft.com',
  'marketplace.visualstudio.com',
  'pkg.go.dev',
]);

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.trim()).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

/** GitHub owner of a github.com repo URL, lowercased, else null. */
function githubOwner(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    return u.pathname.split('/')[1]?.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * True when `websiteUrl` is a generic site (above) that doesn't belong to
 * the owner of `listingUrl`'s GitHub repo. False for unparseable input.
 */
export function isGenericWebsite(
  websiteUrl: string | null | undefined,
  listingUrl?: string | null,
): boolean {
  const host = hostOf(websiteUrl);
  if (!host) return false;
  const bare = host.replace(/^www\./, '');
  if (PRODUCT_PAGE_HOSTS.has(bare)) return false;
  for (const [domain, owners] of Object.entries(GENERIC_WEBSITE_HOSTS)) {
    const d = domain.replace(/^www\./, '');
    const exactOnly = domain !== d || domain.split('.').length > 2;
    const matches = exactOnly
      ? bare === d
      : bare === d || bare.endsWith(`.${d}`);
    if (!matches) continue;
    const owner = githubOwner(listingUrl);
    return !(owner && owners.includes(owner));
  }
  return false;
}
