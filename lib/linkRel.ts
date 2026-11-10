/**
 * SEO link policy for outbound listing links. Payment never buys a dofollow
 * link: Google treats paid links without rel="sponsored" as link schemes.
 *
 * - Website: dofollow only while a reciprocal AllMCPs backlink is confirmed
 *   live *on that website* (the free badge program, rechecked by the health
 *   cron). A Premium listing without one gets rel="sponsored" (paid
 *   relationship, disclosed); everything else is nofollow.
 * - Repo: dofollow when the listing is vendor-official or owner-verified (an
 *   approved claim), never because of Premium.
 * - Support: follows the website rule, and only earns dofollow when it points
 *   at the listing's own website.
 * - README/description markdown links: rel="ugc nofollow" (MARKDOWN_LINK_REL),
 *   since that text comes from the listing's source, not from us.
 *
 * NOTE: the website rule is gated on `websiteBacklinkOk`, not the
 * `reciprocalBadgeOk` aggregate: a badge that only lives in the repo README
 * must not earn ranking credit for an unrelated marketing site. The README
 * badge is a separate verification (see db/schema.ts `readmeBadgeOk`).
 */

const DOFOLLOW = 'noopener noreferrer';
const NOFOLLOW = 'noopener noreferrer nofollow';
const SPONSORED = 'noopener noreferrer sponsored';

/** rel for links inside README / description markdown (third-party text). */
export const MARKDOWN_LINK_REL = 'ugc nofollow noopener noreferrer';

export function websiteLinkRel(
  isPremium: boolean,
  websiteBacklinkOk: boolean,
): string {
  if (websiteBacklinkOk) return DOFOLLOW;
  return isPremium ? SPONSORED : NOFOLLOW;
}

export function repoLinkRel(listing: {
  isOfficial?: boolean | null;
  ownerVerified?: boolean | null;
}): string {
  return listing.isOfficial || listing.ownerVerified ? DOFOLLOW : NOFOLLOW;
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
 * Support links follow the website rule: dofollow only with a live website
 * backlink AND when the support URL is on that same website (an unrelated
 * help desk, Discord or third-party domain stays nofollow). A Premium listing
 * without the backlink gets rel="sponsored" on its own-site support link.
 */
export function supportLinkRel(
  isPremium: boolean,
  websiteBacklinkOk: boolean,
  supportUrl?: string | null,
  websiteUrl?: string | null,
): string {
  if (!sameHost(supportUrl, websiteUrl)) return NOFOLLOW;
  return websiteLinkRel(isPremium, websiteBacklinkOk);
}
