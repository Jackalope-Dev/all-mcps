/**
 * Shared helpers for catalog quality enrichment (GitHub import cleanup).
 * Used by /api/cron/enrich — keep pure/network pieces testable and rate-limit aware.
 */

import { cleanListingDescription } from './description';
import { githubApiHeaders } from './githubAuth';
import {
  resolveInstallConfig,
  resolveInstallFromText,
  toCachedInstallFields,
} from './installConfig';
import { isSafeSubmissionUrl } from './urlSafety';

export {
  pickBestWebsiteAndLogo,
  pickBestWebsiteAndLogoWithLlm,
} from './listingSignals';

export type GhRepo = {
  full_name?: string;
  description?: string | null;
  homepage?: string | null;
  stargazers_count?: number;
  archived?: boolean;
  disabled?: boolean;
  html_url?: string;
  owner?: { login?: string; avatar_url?: string; type?: string };
  topics?: string[];
};

export function parseGithubUrl(
  url: string,
): { owner: string; repo: string } | null {
  const m = (url || '').match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  let repo = m[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);
  return { owner: m[1], repo };
}

/** True when the stored description still looks like a scraped Glama/README header. */
export function descriptionNeedsClean(
  description: string | null | undefined,
): boolean {
  if (!description) return true;
  const d = description.trim();
  if (d.length < 24) return true;
  if (/glama\.ai\/mcp/i.test(d)) return true;
  if (/^\[\]\(https?:\/\//.test(d)) return true;
  if (/^!\[[^\]]*\]\(https?:\/\//.test(d)) return true;
  // Leading platform emoji dump (📇 ☁️ 🏠 …) with little prose
  if (
    /^(?:[\p{Extended_Pictographic}\s]|\uFE0F|\u200D)+[-–—]/u.test(d) &&
    d.length < 120
  )
    return true;
  return false;
}

export function pickDescription(
  current: string,
  ghDescription: string | null | undefined,
): string {
  const cleanedCurrent = cleanListingDescription(current);
  const cleanedGh = cleanListingDescription(ghDescription || '');

  // Prefer cleaned stored text if it's substantial after chrome strip.
  if (cleanedCurrent.length >= 40 && !/glama\.ai/i.test(cleanedCurrent)) {
    return cleanedCurrent.slice(0, 2000);
  }
  if (cleanedGh.length >= 20) {
    return cleanedGh.slice(0, 2000);
  }
  return (cleanedCurrent || cleanedGh || current || '').slice(0, 2000);
}

export function pickWebsiteUrl(
  current: string | null | undefined,
  homepage: string | null | undefined,
): string | null {
  if (
    current &&
    isSafeSubmissionUrl(current) &&
    !/github\.com/i.test(current)
  ) {
    return current;
  }
  const h = (homepage || '').trim();
  if (!h) return current || null;
  // Normalize protocol-relative / bare domains
  let candidate = h;
  if (candidate.startsWith('//')) candidate = `https:${candidate}`;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  if (!isSafeSubmissionUrl(candidate)) return current || null;
  if (/github\.com/i.test(candidate)) return current || null;
  return candidate;
}

export function resolveInstallFromSignals(input: {
  id: string;
  name: string;
  url: string;
  description: string;
  readme: string | null;
}): ReturnType<typeof toCachedInstallFields> | null {
  if (input.readme) {
    const fromReadme = resolveInstallFromText(input.readme, input);
    // A README hint that isn't persistable (a "remote" URL that isn't endpoint-shaped)
    // falls through to the deterministic resolve rather than ending the search here.
    const cacheable = fromReadme ? toCachedInstallFields(fromReadme) : null;
    if (cacheable) return cacheable;
  }
  const resolved = resolveInstallConfig({
    id: input.id,
    name: input.name,
    url: input.url,
    description: input.description,
  });
  if (resolved.confidence === 'low' && resolved.source === 'heuristic') {
    return null;
  }
  return toCachedInstallFields(resolved);
}

export async function fetchGithubRepo(
  owner: string,
  repo: string,
  token?: string | null,
): Promise<{ ok: true; data: GhRepo } | { ok: false; status: number }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubApiHeaders(
      token,
      'application/vnd.github+json',
      'AllMCPs-Enricher',
    ),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return { ok: false, status: res.status };
  const data = (await res.json()) as GhRepo;
  return { ok: true, data };
}

export async function fetchGithubReadme(
  owner: string,
  repo: string,
  token?: string | null,
): Promise<string | null> {
  for (const branch of ['main', 'master']) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`,
        {
          headers: { 'User-Agent': 'AllMCPs-Enricher' },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (res.ok) return await res.text();
    } catch {
      /* next */
    }
  }

  // API fallback (uses token quota when raw is blocked)
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      {
        headers: githubApiHeaders(
          token,
          'application/vnd.github+json',
          'AllMCPs-Enricher',
        ),
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string; encoding?: string };
    if (data.content && data.encoding === 'base64') {
      try {
        return atob(data.content.replace(/\n/g, ''));
      } catch {
        return null;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type LogoSource =
  | 'readme'
  | 'website_favicon'
  | 'github_org'
  | 'github_user'
  | 'manual';

export function logoSourcePriority(source: string | null | undefined): number {
  switch (source) {
    case 'manual':
      return 5;
    case 'readme':
      return 4;
    case 'website_favicon':
      return 3;
    case 'github_org':
      return 2;
    case 'github_user':
      return 1;
    default:
      return 0;
  }
}

const EXCLUDED_DOMAINS_FOR_WEBSITE = [
  'github.com',
  'github.io',
  'github.blog',
  'githubusercontent.com',
  'raw.githubusercontent.com',
  'github-readme-stats.vercel.app',
  'npmjs.com',
  'npmjs.org',
  'pypi.org',
  'crates.io',
  'packagist.org',
  'deno.land',
  'pkg.go.dev',
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
  'linkedin.com',
  'discord.gg',
  'discord.com',
  't.me',
  'telegram.me',
  'shields.io',
  'badge.fury.io',
  'img.shields.io',
  'badgen.net',
  'codecov.io',
  'travis-ci.org',
  'travis-ci.com',
  'circleci.com',
  'glama.ai',
  'smithery.ai',
  'pulse.mcp.so',
  'pulsemcp.com',
  'localhost',
  '127.0.0.1',
];

/** Extract candidate website URLs from a README. */
export function extractCandidateWebsitesFromReadme(
  readme: string,
  ghOwner: string,
  ghRepo: string,
): string[] {
  if (!readme) return [];
  const urls = new Set<string>();

  // Extract markdown link destinations [text](url)
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)"]+)\)/g;
  for (const m of readme.matchAll(mdLinkRegex)) {
    const linkText = m[1].toLowerCase();
    const href = m[2].trim();
    if (
      linkText.includes('website') ||
      linkText.includes('home') ||
      linkText.includes('docs') ||
      linkText.includes('demo') ||
      linkText.includes(ghRepo.toLowerCase())
    ) {
      urls.add(href);
    }
  }

  // Extract all http(s) URLs
  const plainUrlRegex = /https?:\/\/[^\s<>)"]+/g;
  for (const m of readme.matchAll(plainUrlRegex)) {
    const raw = m[0].replace(/[.,;:!?]+$/, '');
    urls.add(raw);
  }

  const valid: string[] = [];
  for (const url of urls) {
    if (!isSafeSubmissionUrl(url)) continue;
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }

    if (
      EXCLUDED_DOMAINS_FOR_WEBSITE.some(
        (d) => host === d || host.endsWith(`.${d}`),
      )
    ) {
      continue;
    }

    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|pdf|zip|gz)$/i.test(url)) {
      continue;
    }

    valid.push(url);
  }

  return valid.slice(0, 10);
}

/** Extract candidate image URLs (logos/banners) from a README, prioritizing light/universal modes. */
export function extractCandidateImagesFromReadme(
  readme: string,
  ghOwner: string,
  ghRepo: string,
  branch = 'main',
): string[] {
  if (!readme) return [];
  const lightImages = new Set<string>();
  const images = new Set<string>();

  // Extract <picture> tags with prefers-color-scheme: light
  const pictureRegex = /<picture>([\s\S]*?)<\/picture>/gi;
  for (const picMatch of readme.matchAll(pictureRegex)) {
    const picContent = picMatch[1];
    const lightSource = picContent.match(
      /<source[^>]+media=["'][^"']*prefers-color-scheme:\s*light[^"']*["'][^>]+srcset=["']([^"'\s]+)["']/i,
    );
    if (lightSource?.[1]) {
      lightImages.add(lightSource[1].trim());
    }
  }

  // Markdown image syntax ![]()
  const mdImgRegex =
    /!\[[^\]]*\]\((https?:\/\/[^\s)"]+|\/[^\s)"]+|[^\s)"]+)\)/g;
  for (const m of readme.matchAll(mdImgRegex)) {
    const src = m[1].trim();
    if (src.includes('gh-light-mode-only') || src.includes('theme=light')) {
      lightImages.add(src);
    } else if (!src.includes('gh-dark-mode-only')) {
      images.add(src);
    }
  }

  // HTML img tags <img ... src="..." ...>
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  for (const m of readme.matchAll(htmlImgRegex)) {
    const src = m[1].trim();
    if (src.includes('gh-light-mode-only') || src.includes('theme=light')) {
      lightImages.add(src);
    } else if (!src.includes('gh-dark-mode-only')) {
      images.add(src);
    }
  }

  const allCandidates = [...Array.from(lightImages), ...Array.from(images)];
  const valid: string[] = [];
  for (let src of allCandidates) {
    if (
      /shields\.io|badge|codecov|github-actions|workflow|license|build|downloads|stars|forks|contributors|last-commit/i.test(
        src,
      )
    ) {
      continue;
    }

    if (!/^https?:\/\//i.test(src)) {
      const cleanPath = src.replace(/^\.\//, '').replace(/^\//, '');
      src = `https://raw.githubusercontent.com/${ghOwner}/${ghRepo}/${branch}/${cleanPath}`;
    }

    if (!isSafeSubmissionUrl(src)) continue;
    if (!valid.includes(src)) valid.push(src);
  }

  return valid.slice(0, 5);
}

/** Fetch metadata for npm packages to discover homepage/repository URLs when missing. */
export async function fetchPackageRegistryMetadata(
  packageName: string,
): Promise<{ websiteUrl?: string; repoUrl?: string } | null> {
  if (!packageName) return null;
  const cleanName = packageName
    .trim()
    .replace(/^npx\s+/, '')
    .replace(/^uvx\s+/, '');
  if (!cleanName || cleanName.includes(' ') || cleanName.startsWith('http'))
    return null;

  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(cleanName)}`,
      {
        headers: {
          'User-Agent': 'AllMCPs-Enricher/1.0 (+https://allmcps.com)',
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      homepage?: string;
      repository?: { url?: string } | string;
    };

    const out: { websiteUrl?: string; repoUrl?: string } = {};
    if (
      data.homepage &&
      isSafeSubmissionUrl(data.homepage) &&
      !/github\.com/i.test(data.homepage)
    ) {
      out.websiteUrl = data.homepage;
    }
    const repoRaw =
      typeof data.repository === 'string'
        ? data.repository
        : data.repository?.url;
    if (repoRaw) {
      const match = repoRaw.match(/github\.com\/([^/]+\/[^/#?.]+)/i);
      if (match) {
        out.repoUrl = `https://github.com/${match[1]}`;
      }
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Best-effort check that a package still resolves on its registry (npm or PyPI, inferred from installCommand). */
export async function isPackageInstallable(
  installCommand: string | null | undefined,
  pkg: string | null | undefined,
): Promise<boolean> {
  const cleanPkg = (pkg || '').trim();
  if (!cleanPkg || cleanPkg.startsWith('http') || cleanPkg.includes(' '))
    return false;
  const cmd = (installCommand || '').toLowerCase();
  const isPython = /uvx|pipx|pip\b|python/.test(cmd);

  try {
    if (isPython) {
      const res = await fetch(
        `https://pypi.org/pypi/${encodeURIComponent(cleanPkg)}/json`,
        {
          headers: { 'User-Agent': 'AllMCPs-Health-Checker' },
          signal: AbortSignal.timeout(6000),
        },
      );
      return res.ok;
    }
    // Default to npm — covers npx/bunx/npm/pnpm/yarn and any other/unset runner,
    // since most stdio listings in this catalog are npm packages.
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(cleanPkg)}`,
      {
        headers: { 'User-Agent': 'AllMCPs-Health-Checker' },
        signal: AbortSignal.timeout(6000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export type LiveInterfaceSignals = {
  /** Set once the primary URL (typically the GitHub repo) is confirmed 404/archived/disabled. */
  githubDead: boolean;
  /** Cached or freshly-checked remote-endpoint health. null/undefined = no endpoint or not checked — treated as "can't rule out alive", not as a dead signal. */
  remoteEndpointHealthy?: boolean | null;
  installCommand?: string | null;
  installPackage?: string | null;
};

/**
 * A listing is only "truly dead" when every interface it exposes is confirmed
 * unreachable. A broken source-repo link alone isn't enough to unpublish —
 * the npm/pypi package can still install, or a hosted remote endpoint can
 * still respond, even after the repo itself is gone/renamed/made private.
 * Unknown/unchecked signals (no remote endpoint, no install package, a check
 * that errors) never count as "confirmed dead" — only an explicit failure
 * does, so this stays conservative rather than trigger-happy.
 */
export async function isListingTrulyDead(
  signals: LiveInterfaceSignals,
): Promise<boolean> {
  if (!signals.githubDead) return false;
  if (signals.remoteEndpointHealthy) return false;
  if (signals.installPackage) {
    const installable = await isPackageInstallable(
      signals.installCommand,
      signals.installPackage,
    );
    if (installable) return false;
  }
  return true;
}

/** Given a website URL, extracts favicon, apple-touch-icon, og:image or Google Favicon URL. */
export async function extractWebsiteFaviconUrl(
  websiteUrl: string,
): Promise<string | null> {
  if (!websiteUrl || !isSafeSubmissionUrl(websiteUrl)) return null;

  try {
    const res = await fetch(websiteUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'AllMCPs-Enricher/1.0 (+https://allmcps.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const html = (await res.text()).slice(0, 150_000);

      // 1. Apple Touch Icon
      const appleMatch = html.match(
        /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
      );
      if (appleMatch?.[1]) {
        return new URL(appleMatch[1], websiteUrl).href;
      }

      // 2. og:image
      const ogMatch =
        html.match(
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        ) ||
        html.match(
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        );
      if (ogMatch?.[1]) {
        return new URL(ogMatch[1], websiteUrl).href;
      }

      // 3. Icon / shortcut icon
      const iconMatch = html.match(
        /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
      );
      if (iconMatch?.[1]) {
        return new URL(iconMatch[1], websiteUrl).href;
      }
    }
  } catch {
    /* fallback to Google favicon service */
  }

  // Google Favicon service returns 256x256 PNG for domain
  try {
    const domain = new URL(websiteUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`;
  } catch {
    return null;
  }
}

/**
 * Bare technical labels ("mcp", "mcp-server", "reference-data") that a
 * scraped import can leave as `servers.name` instead of an actual product
 * title — usually because the source was an npm/package name rather than a
 * human-written title. A name is generic when every one of its words (split
 * on whitespace/hyphen/underscore) is one of these, and there are few enough
 * words that it reads as a label rather than a real title — "Kai AGI -
 * Autonomous AI Agent" has "agent" in the set but enough other words that
 * it's clearly a real name, not a placeholder.
 */
const GENERIC_NAME_WORDS = new Set([
  'mcp',
  'server',
  'servers',
  'tool',
  'tools',
  'toolkit',
  'toolset',
  'api',
  'client',
  'service',
  'services',
  'app',
  'core',
  'cli',
  'sdk',
  'docs',
  'doc',
  'documentation',
  'gateway',
  'assistant',
  'agent',
  'agents',
  'memory',
  'registry',
  'catalog',
  'marketplace',
  'monitoring',
  'audit',
  'booking',
  'library',
  'libraries',
  'reference',
  'data',
  'hub',
  'kit',
  'connector',
  'connectors',
  'integration',
  'integrations',
  'bridge',
  'proxy',
  'wrapper',
  'adapter',
  'util',
  'utils',
  'utility',
  'utilities',
  'backend',
  'frontend',
  'platform',
  'system',
  'framework',
  'plugin',
  'plugins',
  'extension',
  'module',
]);

/** Words too generic to carry a fetched title/repo-slug/hostname as a listing name. */
export function isGenericServerName(name: string | null | undefined): boolean {
  const words = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  if (words.length === 0) return true;
  if (words.length > 3) return false;
  return words.every((w) => GENERIC_NAME_WORDS.has(w));
}

const ACRONYMS = new Set([
  'mcp',
  'api',
  'ai',
  'sdk',
  'cli',
  'ui',
  'ux',
  'db',
  'sql',
  'aws',
  'gcp',
  'http',
  'https',
  'url',
  'uri',
  'id',
  'ios',
  'saas',
  'crm',
  'erp',
  'seo',
  'llm',
  'rag',
  'json',
  'xml',
  'yaml',
  'csv',
  'pdf',
  'html',
  'css',
  'js',
  'ts',
  'npm',
  'cdn',
  'dns',
  'ip',
  'vpn',
  'otp',
  'jwt',
  'oauth',
  'rest',
  'graphql',
  'grpc',
  'k8s',
]);

/** Turns a repo/package slug or hostname label into a readable title, keeping known acronyms uppercase. */
export function humanizeSlug(slug: string): string {
  const words = slug
    .replace(/\.git$/i, '')
    .split(/[-_\s]+/)
    .flatMap((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' '))
    .filter(Boolean);
  return words
    .map((w) => {
      const lower = w.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function cleanReadmeHeadingText(line: string): string {
  let s = line.replace(/^#{1,6}\s*/, '');
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); // images
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // links -> visible text
  s = s.replace(/<[^>]+>/g, ''); // stray html tags
  s = s.replace(/[`*_~]+/g, ''); // markdown emphasis markers
  s = s.replace(
    /[\u{1F1E6}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/gu,
    '',
  ); // emoji/arrows
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Common doc-section headings that show up as a README's first *markdown*
 * heading when the real title is instead set in an HTML `<h1>` (common in
 * badge-heavy READMEs, e.g. `<h1 align="center">Foo</h1>`) — so the naive
 * "first heading" scan lands on "Quick Start" or "Table of Contents" instead
 * of the project name. Filtered out so extractReadmeTitle falls through to
 * the slug/hostname fallback instead of returning one of these verbatim.
 */
// Word sequences, not substrings — checked by comparing whole words so a
// phrase like "skill" can't false-positive-match a real title like
// "Skillsforge MCP" the way a naive .startsWith() would.
const NON_TITLE_HEADING_PHRASES = [
  'quick start',
  'quickstart',
  'getting started',
  'table of contents',
  'toc',
  'installation',
  'install',
  'one-line install',
  'usage',
  'features',
  'overview',
  'introduction',
  'about',
  'prerequisites',
  'requirements',
  'setup',
  'configuration',
  'license',
  'licence',
  'contributing',
  'contribution',
  'faq',
  'examples',
  'example',
  'demo',
  'documentation',
  'docs',
  'api reference',
  'reference',
  'changelog',
  'roadmap',
  'support',
  'contact',
  'acknowledgements',
  'acknowledgments',
  'credits',
  'try it',
  'how it works',
  'background',
  'motivation',
  'disclaimer',
  'notes',
  'todo',
  'status',
  'tools',
  'tools available',
  'available tools',
  'skills',
  'skill',
].map((p) => p.split(' '));

/** First-word filler that marks a heading as prose ("The tools", "Why teams use it") rather than a title. */
const NON_TITLE_FIRST_WORDS = new Set([
  'the',
  'a',
  'an',
  'this',
  'that',
  'these',
  'those',
  'it',
  'here',
  'available',
  'why',
  'what',
]);

/**
 * Single-word doc-section nouns pulled from NON_TITLE_HEADING_PHRASES, plus a
 * few more. On a *short* heading (<=4 words) any of these appearing anywhere
 * — not just as the first word — is a strong signal the whole heading is a
 * section label ("Development Status", "SVGator MCP Server — Documentation",
 * "Quick Setup"), not a product name. Not applied to longer headings, where a
 * real title could plausibly contain one of these words incidentally.
 */
const STRONG_SECTION_NOUNS = new Set([
  ...NON_TITLE_HEADING_PHRASES.filter((p) => p.length === 1).map((p) => p[0]),
  'contents',
  'documentation',
]);

function looksLikeSectionHeading(cleaned: string): boolean {
  const lower = cleaned.toLowerCase();
  if (lower.endsWith('?')) return true; // "What is Shipeasy?" reads as doc prose, not a title
  if (/^\d/.test(cleaned)) return true; // "1 — The skill (...)" is a numbered doc step, not a title
  const words = lower
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean); // drop punctuation-only tokens (e.g. a bare em-dash) so they don't inflate the word count
  if (words.length === 0) return true;
  if (NON_TITLE_FIRST_WORDS.has(words[0])) return true;
  if (words.length <= 4 && words.some((w) => STRONG_SECTION_NOUNS.has(w)))
    return true;
  return NON_TITLE_HEADING_PHRASES.some(
    (phrase) =>
      words.length >= phrase.length && phrase.every((pw, i) => words[i] === pw),
  );
}

/** Short connector words that don't have to be capitalized for a heading to still read as Title Case. */
const TITLE_CASE_CONNECTORS = new Set([
  'of',
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'in',
  'on',
  'to',
  'with',
  'by',
  'at',
  'vs',
  'via',
]);

/**
 * Real project titles are near-universally Title Case ("GrabzIt MCP Server",
 * "Weather Wizard MCP"). A doc-prose sentence that dodges every other filter
 * here ("Let your agent install it") is sentence case instead — only its
 * first word capitalized. Requiring most non-connector words to start
 * uppercase catches those without needing to enumerate every possible
 * sentence opener.
 */
function looksTitleCased(cleaned: string): boolean {
  const words = cleaned.split(/\s+/).filter(Boolean);
  let checkable = 0;
  let capitalized = 0;
  for (const w of words) {
    const bare = w.replace(/[^A-Za-z]/g, '');
    if (!bare) continue; // punctuation/number-only token
    if (TITLE_CASE_CONNECTORS.has(bare.toLowerCase())) continue;
    checkable++;
    if (/[A-Z]/.test(w[0])) capitalized++;
  }
  if (checkable === 0) return true; // nothing to judge (e.g. all connectors/numbers) — don't reject
  return capitalized / checkable >= 0.7;
}

/** True when a cleaned heading is usable as a listing title on its own. */
function isUsableReadmeTitle(cleaned: string): boolean {
  // Real product names run short; anything longer is more likely a marketing
  // tagline used as the h1 ("One Engineering Playbook. Synced Everywhere...")
  // — the humanized-slug fallback makes a cleaner listing name than that.
  if (cleaned.length < 3 || cleaned.length > 50) return false;
  if (isGenericServerName(cleaned)) return false;
  if (looksLikeSectionHeading(cleaned)) return false;
  // A bare, space-free slug/package-name heading ("@scope/pkg", "foo-mcp-server")
  // isn't really a title — the humanized-slug fallback reads better than reusing it verbatim.
  if (!/\s/.test(cleaned)) return false;
  if (!looksTitleCased(cleaned)) return false;
  return true;
}

/** Best-guess project title from a README's first top-level heading (typically the h1). */
export function extractReadmeTitle(
  readme: string | null | undefined,
): string | null {
  if (!readme) return null;

  // Prefer an HTML <h1> if the README opens with one (common for centered
  // logo+title blocks) — a markdown `#` heading further down is usually a
  // doc section, not the title, in that case.
  const htmlH1 = readme.slice(0, 3000).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (htmlH1) {
    const cleaned = cleanReadmeHeadingText(htmlH1[1]);
    if (isUsableReadmeTitle(cleaned)) return cleaned;
  }

  const lines = readme.split('\n').slice(0, 40);
  for (const raw of lines) {
    const line = raw.trim();
    if (!/^#{1,2}\s+\S/.test(line)) continue;
    const cleaned = cleanReadmeHeadingText(line);
    if (isUsableReadmeTitle(cleaned)) return cleaned;
  }
  return null;
}

/**
 * Replacement title for a listing whose stored `name` is a bare technical
 * label (see isGenericServerName). Preference order: the repo's own README
 * title > a humanized repo slug (falling back to the org/owner name when the
 * repo slug is itself generic, e.g. a repo literally named "mcp") > a
 * humanized hostname for non-GitHub listings. Returns null when the current
 * name isn't generic, or no better candidate could be derived.
 */
export function deriveServerName(input: {
  currentName: string;
  url: string;
  ghRepo?: { owner: string; repo: string } | null;
  readme?: string | null;
}): string | null {
  if (!isGenericServerName(input.currentName)) return null;

  const fromReadme = extractReadmeTitle(input.readme);
  if (
    fromReadme &&
    fromReadme.toLowerCase() !== input.currentName.trim().toLowerCase()
  ) {
    return fromReadme.slice(0, 80);
  }

  if (input.ghRepo) {
    const { owner, repo } = input.ghRepo;
    const base = isGenericServerName(repo)
      ? humanizeSlug(owner)
      : humanizeSlug(repo);
    if (!base) return null;
    return /\bmcp\b/i.test(base) ? base : `${base} MCP`;
  }

  try {
    const host = new URL(input.url).hostname.replace(/^www\./i, '');
    const parts = host.split('.').filter(Boolean);
    const label = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (!label || isGenericServerName(label)) return null;
    const base = humanizeSlug(label);
    return /\bmcp\b/i.test(base) ? base : `${base} MCP`;
  } catch {
    return null;
  }
}
