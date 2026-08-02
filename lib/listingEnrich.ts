/**
 * Shared helpers for catalog quality enrichment (GitHub import cleanup).
 * Used by /api/cron/enrich — keep pure/network pieces testable and rate-limit aware.
 */

import { cleanListingDescription } from './description';
import { isSafeSubmissionUrl } from './urlSafety';
import {
  resolveInstallFromText,
  resolveInstallConfig,
  toCachedInstallFields,
} from './installConfig';
import { githubApiHeaders } from './githubAuth';
import { chatJson } from './openai';

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

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const m = (url || '').match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  let repo = m[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);
  return { owner: m[1], repo };
}

/** True when the stored description still looks like a scraped Glama/README header. */
export function descriptionNeedsClean(description: string | null | undefined): boolean {
  if (!description) return true;
  const d = description.trim();
  if (d.length < 24) return true;
  if (/glama\.ai\/mcp/i.test(d)) return true;
  if (/^\[\]\(https?:\/\//.test(d)) return true;
  if (/^!\[[^\]]*\]\(https?:\/\//.test(d)) return true;
  // Leading platform emoji dump (📇 ☁️ 🏠 …) with little prose
  if (/^[\p{Extended_Pictographic}\s️‍]+[-–—]/u.test(d) && d.length < 120) return true;
  return false;
}

export function pickDescription(current: string, ghDescription: string | null | undefined): string {
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
  homepage: string | null | undefined
): string | null {
  if (current && isSafeSubmissionUrl(current) && !/github\.com/i.test(current)) {
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
    if (fromReadme) return toCachedInstallFields(fromReadme);
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
  token?: string | null
): Promise<{ ok: true; data: GhRepo } | { ok: false; status: number }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubApiHeaders(token, 'application/vnd.github+json', 'AllMCPs-Enricher'),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return { ok: false, status: res.status };
  const data = (await res.json()) as GhRepo;
  return { ok: true, data };
}

export async function fetchGithubReadme(
  owner: string,
  repo: string,
  token?: string | null
): Promise<string | null> {
  for (const branch of ['main', 'master']) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`,
        { headers: { 'User-Agent': 'AllMCPs-Enricher' }, signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) return await res.text();
    } catch {
      /* next */
    }
  }

  // API fallback (uses token quota when raw is blocked)
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: githubApiHeaders(token, 'application/vnd.github+json', 'AllMCPs-Enricher'),
      signal: AbortSignal.timeout(12000),
    });
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

export type LogoSource = 'readme' | 'website_favicon' | 'github_org' | 'github_user' | 'manual';

export function logoSourcePriority(source: string | null | undefined): number {
  switch (source) {
    case 'manual': return 5;
    case 'readme': return 4;
    case 'website_favicon': return 3;
    case 'github_org': return 2;
    case 'github_user': return 1;
    default: return 0;
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
  'localhost',
  '127.0.0.1',
];

/** Extract candidate website URLs from a README. */
export function extractCandidateWebsitesFromReadme(
  readme: string,
  ghOwner: string,
  ghRepo: string
): string[] {
  if (!readme) return [];
  const urls = new Set<string>();

  // Extract markdown link destinations [text](url)
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)\"]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLinkRegex.exec(readme)) !== null) {
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
  const plainUrlRegex = /https?:\/\/[^\s<>\)\"]+/g;
  while ((m = plainUrlRegex.exec(readme)) !== null) {
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

    if (EXCLUDED_DOMAINS_FOR_WEBSITE.some((d) => host === d || host.endsWith('.' + d))) {
      continue;
    }

    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|pdf|zip|gz)$/i.test(url)) {
      continue;
    }

    valid.push(url);
  }

  return valid.slice(0, 10);
}

/** Extract candidate image URLs (logos/banners) from a README. */
export function extractCandidateImagesFromReadme(
  readme: string,
  ghOwner: string,
  ghRepo: string,
  branch = 'main'
): string[] {
  if (!readme) return [];
  const images = new Set<string>();

  // Markdown image syntax ![]()
  const mdImgRegex = /!\[[^\]]*\]\((https?:\/\/[^\s\)\"]+|\/[^\s\)\"]+|[^\s\)\"]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdImgRegex.exec(readme)) !== null) {
    images.add(m[1].trim());
  }

  // HTML img tags <img ... src="..." ...>
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((m = htmlImgRegex.exec(readme)) !== null) {
    images.add(m[1].trim());
  }

  const valid: string[] = [];
  for (let src of images) {
    if (
      /shields\.io|badge|codecov|github-actions|workflow|license|build|downloads|stars|forks|contributors|last-commit/i.test(
        src
      )
    ) {
      continue;
    }

    if (!/^https?:\/\//i.test(src)) {
      const cleanPath = src.replace(/^\.\//, '').replace(/^\//, '');
      src = `https://raw.githubusercontent.com/${ghOwner}/${ghRepo}/${branch}/${cleanPath}`;
    }

    if (!isSafeSubmissionUrl(src)) continue;
    valid.push(src);
  }

  return valid.slice(0, 5);
}

/**
 * Uses LLM to pick the official website URL and best logo image URL from candidates.
 * Soft fails to null on missing key, quota, or network error.
 */
export async function pickBestWebsiteAndLogoWithLlm(input: {
  readmeSnippet: string;
  ghOwner: string;
  ghRepo: string;
  candidateUrls: string[];
  candidateImages: string[];
}): Promise<{ websiteUrl?: string; logoUrl?: string } | null> {
  if (!input.candidateUrls.length && !input.candidateImages.length) return null;

  const result = await chatJson<{
    websiteUrl?: string;
    logoUrl?: string;
  }>({
    model: 'gpt-4.1-mini',
    maxTokens: 300,
    timeoutMs: 10_000,
    messages: [
      {
        role: 'system',
        content:
          'You extract the official project marketing/documentation website URL and main project logo image URL for an MCP server listing. Return JSON with optional keys websiteUrl and logoUrl. Pick ONLY from the candidate lists provided, or return null if none are suitable.',
      },
      {
        role: 'user',
        content: `Repository: ${input.ghOwner}/${input.ghRepo}\nCandidate Websites:\n${input.candidateUrls.join('\n') || 'None'}\nCandidate Logo Images:\n${input.candidateImages.join('\n') || 'None'}\nREADME excerpt:\n${input.readmeSnippet.slice(0, 1500)}`,
      },
    ],
  });

  if (!result.ok) return null;

  const out: { websiteUrl?: string; logoUrl?: string } = {};
  if (result.data.websiteUrl && input.candidateUrls.includes(result.data.websiteUrl)) {
    out.websiteUrl = result.data.websiteUrl;
  }
  if (result.data.logoUrl && input.candidateImages.includes(result.data.logoUrl)) {
    out.logoUrl = result.data.logoUrl;
  }

  return Object.keys(out).length ? out : null;
}

/** Given a website URL, extracts favicon, apple-touch-icon, og:image or Google Favicon URL. */
export async function extractWebsiteFaviconUrl(websiteUrl: string): Promise<string | null> {
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
      const appleMatch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
      if (appleMatch?.[1]) {
        return new URL(appleMatch[1], websiteUrl).href;
      }

      // 2. og:image
      const ogMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogMatch?.[1]) {
        return new URL(ogMatch[1], websiteUrl).href;
      }

      // 3. Icon / shortcut icon
      const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
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

