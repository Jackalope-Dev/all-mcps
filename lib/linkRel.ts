/**
 * SEO link policy for outbound listing links.
 * - Premium/paid listings: dofollow website (and repo when claimed)
 * - Free listings: nofollow
 * Claimed/official free listings still use nofollow on the website unless premium.
 */
export function websiteLinkRel(isPremium: boolean): string {
  return isPremium ? 'noopener noreferrer' : 'noopener noreferrer nofollow';
}

export function repoLinkRel(isPremium: boolean, isOfficial: boolean): string {
  // Paid listings always dofollow; free claimed listings keep historical dofollow on repo.
  if (isPremium || isOfficial) return 'noopener noreferrer';
  return 'noopener noreferrer nofollow';
}
