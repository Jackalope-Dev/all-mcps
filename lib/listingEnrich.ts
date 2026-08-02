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
