import { isSafeSubmissionUrl } from './urlSafety';
import { getDnsTxtRecordValue, getSiteVerificationToken } from './verificationTokens';

export { getDnsTxtRecordValue, getSiteVerificationToken };

/** Accepts legacy shields.io verified badge or any allmcps.com badge link for this listing. */
export function readmeContainsClaimBadge(readmeText: string, serverId: string): boolean {
  const normalized = readmeText.replace(/\s+/g, '').toLowerCase();
  const needles = [
    `allmcps.com/mcp/${serverId}`.toLowerCase(),
    `allmcps.com/api/badge/${serverId}`.toLowerCase(),
    `[![allmcps verified](https://img.shields.io/badge/allmcps-verified-blue)](https://allmcps.com/mcp/${serverId})`.replace(/\s+/g, '').toLowerCase(),
  ];
  return needles.some((n) => normalized.includes(n));
}

/**
 * Fetch a public website and look for ownership proof:
 * - link/img pointing at this listing or badge
 * - meta name="allmcps-verification" content matching our token
 */
/**
 * True only if the page contains an actual visible AllMCPs badge/link (not just
 * the hidden meta tag) — used for reciprocal-dofollow eligibility, which requires
 * a real backlink, not a hidden verification marker.
 */
export function websiteHasReciprocalBadge(html: string, serverId: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes(`allmcps.com/mcp/${serverId.toLowerCase()}`) ||
    lower.includes(`allmcps.com/api/badge/${serverId.toLowerCase()}`)
  );
}

export async function verifyWebsiteHtml(websiteUrl: string, serverId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isSafeSubmissionUrl(websiteUrl)) {
    return { ok: false, reason: 'Website URL is not a safe public http(s) address.' };
  }

  let res: Response;
  try {
    res = await fetch(websiteUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'AllMCPs-Verification/1.0 (+https://allmcps.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return { ok: false, reason: 'Could not reach the website. Check the URL and try again.' };
  }

  if (!res.ok) {
    return { ok: false, reason: `Website returned HTTP ${res.status}.` };
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    // Still try reading body for simple static hosts
  }

  const html = (await res.text()).slice(0, 500_000);
  const lower = html.toLowerCase();
  const token = getSiteVerificationToken(serverId).toLowerCase();

  const hasMeta =
    (lower.includes('name="allmcps-verification"') && lower.includes(serverId.toLowerCase())) ||
    (lower.includes("name='allmcps-verification'") && lower.includes(serverId.toLowerCase())) ||
    lower.includes(`content="${token}"`) ||
    lower.includes(`content='${token}'`);

  const hasBadgeLink = websiteHasReciprocalBadge(html, serverId);

  if (hasMeta || hasBadgeLink) {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      'Verification badge or meta tag not found. Embed an AllMCPs badge linking to this listing, or add a meta tag with the verification token.',
  };
}

/** Look up TXT records for a hostname via Cloudflare DNS-over-HTTPS. */
export async function verifyDnsTxt(websiteUrl: string, serverId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isSafeSubmissionUrl(websiteUrl)) {
    return { ok: false, reason: 'Website URL is not a safe public http(s) address.' };
  }

  let hostname: string;
  try {
    hostname = new URL(websiteUrl).hostname;
  } catch {
    return { ok: false, reason: 'Invalid website URL.' };
  }

  // Strip www. so apex and www share the same check; query both.
  const apex = hostname.replace(/^www\./i, '');
  const hosts = Array.from(new Set([hostname, apex, `www.${apex}`]));
  const expected = getDnsTxtRecordValue(serverId).toLowerCase();

  for (const host of hosts) {
    try {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=TXT`,
        {
          headers: { Accept: 'application/dns-json' },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        Answer?: Array<{ type: number; data: string }>;
      };
      const answers = data.Answer || [];
      for (const ans of answers) {
        // TXT data often arrives quoted: "allmcps-site-verification=..."
        const value = ans.data.replace(/^"|"$/g, '').replace(/" "/g, '').toLowerCase();
        if (value.includes(expected) || value === expected) {
          return { ok: true };
        }
      }
    } catch {
      // try next host
    }
  }

  return {
    ok: false,
    reason: `DNS TXT record not found. Add a TXT record on ${apex} with value: ${getDnsTxtRecordValue(serverId)}`,
  };
}

export async function verifyGithubReadme(repoUrl: string, serverId: string): Promise<{ ok: boolean; reason?: string }> {
  const githubMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!githubMatch) {
    return { ok: false, reason: 'Repository is not a GitHub URL. Use website badge or DNS verification instead.' };
  }

  const owner = githubMatch[1];
  let repo = githubMatch[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  const branches = ['main', 'master'];
  for (const branch of branches) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const readmeText = await res.text();
      if (readmeContainsClaimBadge(readmeText, serverId)) {
        return { ok: true };
      }
      return {
        ok: false,
        reason: 'Verification badge not found in README. Add an AllMCPs badge linking to this listing.',
      };
    } catch {
      // try next branch
    }
  }

  return { ok: false, reason: 'Could not fetch README from GitHub (main/master).' };
}
