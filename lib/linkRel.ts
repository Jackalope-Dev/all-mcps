/**
 * SEO link policy for outbound listing links.
 * - Premium/paid listings: dofollow website (and repo when claimed)
 * - Free listings: dofollow website only while a reciprocal AllMCPs badge is
 *   confirmed live (rechecked periodically by the health cron); nofollow otherwise
 * Claimed/official free listings still use nofollow on the website unless premium
 * or reciprocal.
 */
export function websiteLinkRel(isPremium: boolean, reciprocalBadgeOk: boolean): string {
  return isPremium || reciprocalBadgeOk ? 'noopener noreferrer' : 'noopener noreferrer nofollow';
}

export function repoLinkRel(isPremium: boolean, isOfficial: boolean): string {
  // Paid listings always dofollow; free claimed listings keep historical dofollow on repo.
  if (isPremium || isOfficial) return 'noopener noreferrer';
  return 'noopener noreferrer nofollow';
}

function sameHost(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  try {
    const hostA = new URL(a).hostname.replace(/^www\./, '').toLowerCase();
    const hostB = new URL(b).hostname.replace(/^www\./, '').toLowerCase();
    return hostA === hostB;
  } catch {
    return false;
  }
}

/**
 * Support links only earn dofollow when the listing has earned it (premium or
 * reciprocal badge) AND the support URL points at their own verified website —
 * an unrelated help-desk/Discord/third-party domain stays nofollow regardless
 * of listing status.
 */
export function supportLinkRel(
  isPremium: boolean,
  reciprocalBadgeOk: boolean,
  supportUrl?: string | null,
  websiteUrl?: string | null
): string {
  const earned = (isPremium || reciprocalBadgeOk) && sameHost(supportUrl, websiteUrl);
  return earned ? 'noopener noreferrer' : 'noopener noreferrer nofollow';
}
