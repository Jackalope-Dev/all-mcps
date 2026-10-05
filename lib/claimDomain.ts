/**
 * Website/DNS claim proofs only show that the claimant controls *some* domain —
 * the one they typed in. That proves ownership of a listing only when the domain
 * is actually tied to the listing; otherwise anyone could verify their own site
 * and take over an unrelated listing (or one someone else already claimed).
 */

function hostOf(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const host = new URL(rawUrl.trim()).hostname.toLowerCase();
    return host.replace(/^www\./, '').replace(/\.$/, '') || null;
  } catch {
    return null;
  }
}

/**
 * Same host, or one is a subdomain of the other (`mcp.acme.com` ↔ `acme.com`).
 * Deliberately *not* "same apex": siblings on shared hosting
 * (`a.onrender.com` vs `b.onrender.com`, `a.github.io` vs `b.github.io`) belong
 * to different people, and we don't ship a public-suffix list.
 */
function hostsRelated(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/**
 * True when `claimWebsiteUrl` is bound to the listing — its host matches the
 * listing's server URL or its existing website. GitHub (or any other
 * repo-host) listings never match a custom site; those claims go through the
 * README badge or admin review.
 */
export function claimWebsiteMatchesListing(
  claimWebsiteUrl: string,
  listing: { url: string; websiteUrl: string | null },
): boolean {
  const claimHost = hostOf(claimWebsiteUrl);
  if (!claimHost) return false;
  return [listing.url, listing.websiteUrl].some((candidate) => {
    const host = hostOf(candidate);
    return !!host && hostsRelated(claimHost, host);
  });
}
