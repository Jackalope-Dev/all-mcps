import { isSafeSubmissionUrl } from './urlSafety';
import { getClaimVerificationToken } from './verificationTokens';

/**
 * True only if the README links to this listing *and* carries this specific
 * user's `verify` token — a bare `allmcps.com/mcp/{id}` link isn't enough,
 * since that's public and generic (anyone could copy it), so it can't tell
 * which account should be credited with ownership. Requiring both means the
 * badge has to be the one this exact signed-in user generated on the claim page.
 */
export function readmeContainsClaimBadge(
  readmeText: string,
  serverId: string,
  userId: string,
): boolean {
  const normalized = readmeText.replace(/\s+/g, '').toLowerCase();
  const hasListingLink = normalized.includes(
    `allmcps.com/mcp/${serverId}`.toLowerCase(),
  );
  const hasUserToken = normalized.includes(`verify=${userId}`.toLowerCase());
  return hasListingLink && hasUserToken;
}

/** rel tokens that strip a link of ranking value (no PageRank/DR flows through). */
const NOFOLLOW_REL_TOKENS = ['nofollow', 'ugc', 'sponsored'];

/**
 * A rel attribute earns dofollow credit only when it carries none of the
 * link-equity-killing tokens (nofollow / ugc / sponsored). An empty/absent rel
 * is dofollow by default.
 */
export function relIsDofollow(relValue: string): boolean {
  const tokens = relValue.toLowerCase().split(/\s+/).filter(Boolean);
  return !tokens.some((t) => NOFOLLOW_REL_TOKENS.includes(t));
}

/**
 * True only if the page carries a real, *dofollow* AllMCPs backlink (not just
 * the hidden meta tag, and not a nofollow'd badge) — used for reciprocal-dofollow
 * eligibility. The whole point of the reciprocal loop is DR: we only hand a free
 * dofollow website link back to sites that actually pass ranking signal to us, so
 * a badge wrapped in rel="nofollow" (or ugc/sponsored), or an unlinked badge
 * image, earns nothing.
 *
 * Rules:
 * - HTML (any `<a>` tags present): at least one anchor must point at our listing
 *   or badge AND be dofollow. A linking anchor that's all nofollow, or a bare
 *   `<img>` badge with no wrapping link, fails.
 * - Plain Markdown/text (no `<a>` tags — e.g. a raw GitHub README badge): rel
 *   can't be expressed, so the presence of our listing/badge URL is enough.
 *
 * Not used for claim proof (see verifyWebsiteHtml) since a generic,
 * unpersonalized badge/link can't tell which account should get credited.
 */
export function websiteHasReciprocalBadge(
  html: string,
  serverId: string,
): boolean {
  const id = serverId.toLowerCase();
  const lower = html.toLowerCase();
  const listingPath = `allmcps.com/mcp/${id}`;
  const badgePath = `allmcps.com/api/badge/${id}`;

  // Must reference our listing or badge somewhere at all.
  if (!lower.includes(listingPath) && !lower.includes(badgePath)) {
    return false;
  }

  const anchors = [...lower.matchAll(/<a\b[^>]*>/gi)];

  // No anchor tags → plain Markdown/text (raw README). rel isn't expressible
  // there, so a rendered link is dofollow by construction — but a lone badge
  // *image* URL isn't a link, so require the listing URL itself to be present
  // (a Markdown badge always wraps the image in a link to the listing).
  if (anchors.length === 0) {
    return lower.includes(listingPath);
  }

  // HTML context → demand a genuine dofollow backlink to our listing/badge.
  for (const [tag] of anchors) {
    const hrefMatch = tag.match(
      /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const href = hrefMatch
      ? hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || ''
      : '';
    if (!href.includes(listingPath) && !href.includes(badgePath)) continue;
    const relMatch = tag.match(/rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const rel = relMatch ? relMatch[1] || relMatch[2] || relMatch[3] || '' : '';
    if (relIsDofollow(rel)) return true;
  }
  return false;
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
  userId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isSafeSubmissionUrl(websiteUrl)) {
    return {
      ok: false,
      reason: 'Website URL is not a safe public http(s) address.',
    };
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
    return {
      ok: false,
      reason: 'Could not reach the website. Check the URL and try again.',
    };
  }

  if (!res.ok) {
    return { ok: false, reason: `Website returned HTTP ${res.status}.` };
  }

  const contentType = res.headers.get('content-type') || '';
  if (
    !contentType.includes('text/html') &&
    !contentType.includes('application/xhtml')
  ) {
    // Still try reading body for simple static hosts
  }

  const html = (await res.text()).slice(0, 500_000);
  const lower = html.toLowerCase();
  const token = getClaimVerificationToken(serverId, userId).toLowerCase();

  const hasMeta =
    lower.includes(token) ||
    lower.includes(`content="${token}"`) ||
    lower.includes(`content='${token}'`);

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
  userId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isSafeSubmissionUrl(websiteUrl)) {
    return {
      ok: false,
      reason: 'Website URL is not a safe public http(s) address.',
    };
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
        },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        Answer?: Array<{ type: number; data: string }>;
      };
      const answers = data.Answer || [];
      for (const ans of answers) {
        // TXT data often arrives quoted: "allmcps-site-verification=..."
        const value = ans.data
          .replace(/^"|"$/g, '')
          .replace(/" "/g, '')
          .toLowerCase();
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

export async function verifyGithubReadme(
  repoUrl: string,
  serverId: string,
  userId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const githubMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!githubMatch) {
    return {
      ok: false,
      reason:
        'Repository is not a GitHub URL. Use website badge or DNS verification instead.',
    };
  }

  const owner = githubMatch[1];
  let repo = githubMatch[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  const branches = ['main', 'master'];
  for (const branch of branches) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`,
        {
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!res.ok) continue;
      const readmeText = await res.text();
      if (readmeContainsClaimBadge(readmeText, serverId, userId)) {
        return { ok: true };
      }
      return {
        ok: false,
        reason:
          'Personalized verification badge not found in README. Copy the badge markdown shown on the claim page (it includes your account link) and try again.',
      };
    } catch {
      // try next branch
    }
  }

  return {
    ok: false,
    reason: 'Could not fetch README from GitHub (main/master).',
  };
}
