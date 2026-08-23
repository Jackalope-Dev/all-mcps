/**
 * SEO link policy for outbound listing links.
 * - Premium/paid listings: dofollow website (and repo when claimed)
 * - Free listings: dofollow website only while a reciprocal AllMCPs backlink is
 *   confirmed live *on that website* (rechecked periodically by the health
 *   cron); nofollow otherwise
 * Claimed/official free listings still use nofollow on the website unless premium
 * or the website itself links back.
 *
 * NOTE: this is gated on `websiteBacklinkOk`, not the `reciprocalBadgeOk`
 * aggregate — a badge that only lives in the repo README must not earn ranking
 * credit for an unrelated marketing site. The README badge is a separate
 * verification (see db/schema.ts `readmeBadgeOk`).
 */
export function websiteLinkRel(isPremium: boolean, websiteBacklinkOk: boolean): string {
  return isPremium || websiteBacklinkOk ? 'noopener noreferrer' : 'noopener noreferrer nofollow';
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
 * Support links only earn dofollow when the listing has earned it (premium or a
 * live website backlink) AND the support URL points at their own verified
 * website — an unrelated help-desk/Discord/third-party domain stays nofollow
 * regardless of listing status. Like `websiteLinkRel`, gated on the
 * website-specific `websiteBacklinkOk`, not the README badge.
 */
export function supportLinkRel(
  isPremium: boolean,
  websiteBacklinkOk: boolean,
  supportUrl?: string | null,
  websiteUrl?: string | null
): string {
  const earned = (isPremium || websiteBacklinkOk) && sameHost(supportUrl, websiteUrl);
  return earned ? 'noopener noreferrer' : 'noopener noreferrer nofollow';
}
