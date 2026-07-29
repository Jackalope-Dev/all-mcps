import { isSafeSubmissionUrl } from './urlSafety';
import { getClaimVerificationToken } from './verificationTokens';

/**
 * True only if the README links to this listing *and* carries this specific
 * user's `verify` token — a bare `allmcps.com/mcp/{id}` link isn't enough,
 * since that's public and generic (anyone could copy it), so it can't tell
 * which account should be credited with ownership. Requiring both means the
 * badge has to be the one this exact signed-in user generated on the claim page.
 */
export function readmeContainsClaimBadge(readmeText: string, serverId: string, userId: string): boolean {
  const normalized = readmeText.replace(/\s+/g, '').toLowerCase();
  const hasListingLink = normalized.includes(`allmcps.com/mcp/${serverId}`.toLowerCase());
  const hasUserToken = normalized.includes(`verify=${userId}`.toLowerCase());
  return hasListingLink && hasUserToken;
}

/**
 * True only if the page contains an actual visible AllMCPs badge/link (not just
 * the hidden meta tag) — used for reciprocal-dofollow eligibility, which requires
 * a real backlink, not a hidden verification marker. Not used for claim proof
 * (see verifyWebsiteHtml) since a generic, unpersonalized badge/link can't tell
 * which account should get credited with ownership.
 */
export function websiteHasReciprocalBadge(html: string, serverId: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes(`allmcps.com/mcp/${serverId.toLowerCase()}`) ||
    lower.includes(`allmcps.com/api/badge/${serverId.toLowerCase()}`)
  );
}

/**
 * Fetch a public website and look for the *personalized* verification meta tag
 * (see getClaimVerificationToken) — proves this specific signed-in user controls
 * the site, for claim purposes. The generic visible badge/link is intentionally
 * not accepted here (see websiteHasReciprocalBadge).
 */
export async function verifyWebsiteHtml(
  websiteUrl: string,
  serverId: string,
  userId: string
): Promise<{ ok: boolean; reason?: string }> {
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
  const token = getClaimVerificationToken(serverId, userId).toLowerCase();

  const hasMeta = lower.includes(`content="${token}"`) || lower.includes(`content='${token}'`);

  if (hasMeta) {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      'Personalized verification meta tag not found. Add the meta tag shown on the claim page (it includes your account id) and try again.',
  };
}

/** Look up TXT records for a hostname via Cloudflare DNS-over-HTTPS, checking for this user's personalized token. */
export async function verifyDnsTxt(
  websiteUrl: string,
  serverId: string,
  userId: string
): Promise<{ ok: boolean; reason?: string }> {
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
  const expected = getClaimVerificationToken(serverId, userId).toLowerCase();

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
    reason: `DNS TXT record not found. Add a TXT record on ${apex} with value: ${getClaimVerificationToken(serverId, userId)}`,
  };
}

export async function verifyGithubReadme(repoUrl: string, serverId: string, userId: string): Promise<{ ok: boolean; reason?: string }> {
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
      if (readmeContainsClaimBadge(readmeText, serverId, userId)) {
        return { ok: true };
      }
      return {
        ok: false,
        reason: 'Personalized verification badge not found in README. Copy the badge markdown shown on the claim page (it includes your account link) and try again.',
      };
    } catch {
      // try next branch
    }
  }

  return { ok: false, reason: 'Could not fetch README from GitHub (main/master).' };
}
