import { isFeaturedListing } from './featuredStatus';

export type FeaturedCandidate = {
  id: string;
  name: string;
  description: string;
  category: string;
  isOfficial?: boolean;
  isPremium?: boolean;
  featuredUntil?: Date | string | number | null;
  views?: number;
  copies?: number;
  upvotes?: number;
};

/**
 * Rank listings for homepage marquee/featured: premium & verified first,
 * then engagement, with light randomness so the shelf isn't frozen forever.
 */
export function pickDiscoveryServers<T extends FeaturedCandidate>(
  servers: T[],
  options: { marquee: number; featured: number }
): { marquee: T[]; featured: T[] } {
  if (servers.length === 0) {
    return { marquee: [], featured: [] };
  }

  const scored = servers.map((s) => {
    const engagement = (s.upvotes || 0) * 5 + (s.copies || 0) + (s.views || 0) * 0.05;
    const boost =
      (isFeaturedListing(s) ? 2000 : 0) +
      (s.isPremium ? 500 : 0) +
      (s.isOfficial ? 800 : 0) +
      Math.random() * 120;
    return { s, score: engagement + boost };
  });

  scored.sort((a, b) => b.score - a.score);

  const featuredCount = Math.min(options.featured, scored.length);
  const marqueeCount = Math.min(options.marquee, Math.max(0, scored.length - featuredCount));

  // Prefer top-ranked for featured cards; marquee draws from the next tier
  // (or wraps if the catalog is small).
  const featured = scored.slice(0, featuredCount).map((x) => x.s);
  const featuredIds = new Set(featured.map((s) => s.id));
  const rest = scored.filter((x) => !featuredIds.has(x.s.id)).map((x) => x.s);
  const marquee =
    rest.length >= marqueeCount
      ? rest.slice(0, marqueeCount)
      : [...rest, ...featured].slice(0, marqueeCount);

  return { marquee, featured };
}
