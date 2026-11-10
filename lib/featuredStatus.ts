/**
 * Shared trust and placement status for listings: the paid tiers (Premium,
 * Featured) and the trust labels (Official, Reference, Verified owner).
 *
 * The two families never mix. Paying buys Featured placement in labelled
 * slots; it never makes a listing Verified or Official.
 */

export type FeaturedFields = {
  isPremium?: boolean | null;
  featuredUntil?: Date | string | number | null;
};

export function isFeaturedListing(
  server: FeaturedFields,
  now = new Date(),
): boolean {
  if (server.isPremium) return true;
  if (!server.featuredUntil) return false;
  const until =
    server.featuredUntil instanceof Date
      ? server.featuredUntil
      : new Date(server.featuredUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > now.getTime();
}

/**
 * Why a listing is Official (`servers.official_source`), recorded by the admin
 * who checked the evidence. 'reference' is a modelcontextprotocol reference
 * server rather than a vendor's own.
 */
export const OFFICIAL_SOURCES = [
  'github-org',
  'vendor-endpoint',
  'registry-namespace',
  'vendor-docs',
  'reference',
] as const;

export type TrustFields = {
  /** Published by the product's own company (admin-set with evidence). */
  isOfficial?: boolean | null;
  /** An approved ownership claim. */
  ownerVerified?: boolean | null;
  officialSource?: string | null;
};

/**
 * "Verified": the listing's owner proved control of it, or the vendor itself
 * publishes it. Premium and Featured never count.
 */
export function isVerifiedListing(server: TrustFields): boolean {
  return !!(server.ownerVerified || server.isOfficial);
}

/** A modelcontextprotocol reference server (Official with source 'reference'). */
export function isReferenceServer(server: TrustFields): boolean {
  return !!server.isOfficial && server.officialSource === 'reference';
}

/** Listing-name endings that name the server, not the product ("Slack MCP Server"). */
const SERVER_SUFFIX =
  /(?:[\s\-_:]+(?:official|remote|hosted|mcp|server|model\s+context\s+protocol|integration|connector|tools?))+$/i;
const SERVER_PREFIX = /^(?:official\s+)?mcp\s+(?:server\s+)?(?:for\s+)?/i;

/**
 * The product or brand a listing name refers to ("Slack MCP" → "Slack"), for
 * the Official tooltip, which must name the vendor's product rather than
 * repeat the listing name. There is no vendor column, so this only strips
 * server wording; null when nothing brand-like is left, and callers fall back
 * to a sentence that names no one.
 */
export function productBrand(name: string | null | undefined): string | null {
  const brand = (name ?? '')
    .trim()
    .replace(SERVER_PREFIX, '')
    .replace(SERVER_SUFFIX, '')
    .trim();
  if (brand.length < 2 || /\bmcp\b/i.test(brand)) return null;
  if (/^(?:server|tools?|integration|connector|official)$/i.test(brand))
    return null;
  return brand;
}

export type TrustLabel = {
  kind: 'official' | 'reference' | 'owner';
  label: 'Official' | 'Reference' | 'Verified owner';
  /** Tooltip / title text. */
  title: string;
};

/**
 * The single trust label a listing shows, strongest first: Official (vendor),
 * Reference (MCP project), then Verified owner. Null for everything else,
 * including paid listings.
 */
export function trustLabel(
  server: TrustFields,
  productName?: string | null,
): TrustLabel | null {
  if (isReferenceServer(server)) {
    return {
      kind: 'reference',
      label: 'Reference',
      title: 'A reference server from the Model Context Protocol project',
    };
  }
  if (server.isOfficial) {
    const brand = productBrand(productName);
    return {
      kind: 'official',
      label: 'Official',
      title: brand
        ? `Published by the company behind ${brand}`
        : 'Published by the vendor',
    };
  }
  if (server.ownerVerified) {
    return {
      kind: 'owner',
      label: 'Verified owner',
      title:
        'The owner proved control of this listing (GitHub README, site badge or DNS record)',
    };
  }
  return null;
}

/** Jackalope Digital, LLC runs AllMCPs; its own servers live in this GitHub org. */
const OPERATOR_REPO = /^https?:\/\/(?:www\.)?github\.com\/jackalope-dev\//i;

/** Disclosure text for listings made by the company that runs AllMCPs. */
export const OPERATOR_DISCLOSURE =
  'Made by Jackalope Digital, which runs AllMCPs';

/**
 * A listing made by AllMCPs' own operator. Shown with OPERATOR_DISCLOSURE
 * wherever it appears, and given nothing the rules don't give every listing.
 */
export function isOperatorListing(server: { url?: string | null }): boolean {
  return !!server.url && OPERATOR_REPO.test(server.url);
}
