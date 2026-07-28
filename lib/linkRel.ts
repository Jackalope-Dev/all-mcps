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
