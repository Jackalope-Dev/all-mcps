import { websiteLinkRel } from './linkRel';

/**
 * Checks that the /mcp/[id] page actually being served gives the listing's
 * website link the rel that `websiteLinkRel` says it should. Exists because a
 * cached ISR render can lag the database: a verified listing kept serving
 * rel="nofollow" for days after earning dofollow (2026-10).
 */

export type RelAuditListing = {
  websiteUrl: string;
  isPremium: boolean | null;
  websiteBacklinkOk: boolean | null;
};

export type RelAuditResult =
  | { ok: true }
  | { ok: false; reason: 'link-missing' | 'rel-mismatch'; rels: string[] };

/** Website/support buttons on the listing page are tagged with this UTM campaign. */
const WEBSITE_BUTTON_CAMPAIGN = 'website_button';

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'));
  return match ? decodeAttr(match[1]) : null;
}

/** The URL without utm_* params or fragment, trailing slash dropped, for comparison. */
export function comparableUrl(href: string): string | null {
  try {
    const url = new URL(href);
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_')) url.searchParams.delete(key);
    }
    url.hash = '';
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    // A bare origin always serializes with "/"; drop it so it matches a stored URL without one.
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** rel values of every website-button anchor in `html` that points at `websiteUrl`. */
export function websiteLinkRelsInHtml(
  html: string,
  websiteUrl: string,
): string[] {
  const target = comparableUrl(websiteUrl);
  if (!target) return [];
  const rels: string[] = [];
  for (const [tag] of html.matchAll(/<a\s[^>]*>/gi)) {
    const href = attr(tag, 'href');
    if (!href) continue;
    let campaign: string | null = null;
    try {
      campaign = new URL(href).searchParams.get('utm_campaign');
    } catch {
      continue;
    }
    if (campaign !== WEBSITE_BUTTON_CAMPAIGN) continue;
    if (comparableUrl(href) !== target) continue;
    rels.push(attr(tag, 'rel') ?? '');
  }
  return rels;
}

const hasNofollow = (rel: string) => /(^|\s)nofollow(\s|$)/i.test(rel);

export function auditListingPageRel(
  html: string,
  listing: RelAuditListing,
): RelAuditResult {
  const expectNofollow = hasNofollow(
    websiteLinkRel(!!listing.isPremium, !!listing.websiteBacklinkOk),
  );
  const rels = websiteLinkRelsInHtml(html, listing.websiteUrl);
  if (rels.length === 0) return { ok: false, reason: 'link-missing', rels };
  if (rels.some((rel) => hasNofollow(rel) !== expectNofollow)) {
    return { ok: false, reason: 'rel-mismatch', rels };
  }
  return { ok: true };
}
