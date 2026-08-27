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

/** Simple seeded PRNG (mulberry32) for deterministic per-user shuffling. */
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rank listings for homepage marquee/featured: premium & verified first,
 * then engagement, with light randomness so the shelf isn't frozen forever.
 */
export function pickDiscoveryServers<T extends FeaturedCandidate>(
  servers: T[],
  options: { marquee: number; featured: number; seed?: number },
): { marquee: T[]; featured: T[] } {
  if (servers.length === 0) {
    return { marquee: [], featured: [] };
  }

  const rand =
    options.seed !== undefined ? seededRandom(options.seed) : Math.random;

  const premiumServers = servers.filter((s) => s.isPremium);
  const nonPremiumServers = servers.filter((s) => !s.isPremium);

  const scored = nonPremiumServers.map((s) => {
    const engagement =
      (s.upvotes || 0) * 5 + (s.copies || 0) + (s.views || 0) * 0.05;
    const boost =
      (isFeaturedListing(s) ? 2000 : 0) +
      // A flat 800 previously let the catalog's ~1 non-premium `isOfficial`
      // listing (a protocol reference/test server, not a typical install
      // pick) outrank virtually all real engagement and occupy a featured
      // slot almost every rotation. Keep a modest nudge for official
      // listings without letting it dominate over genuine upvotes/copies/views.
      (s.isOfficial ? 150 : 0) +
      rand() * 120;
    return { s, score: engagement + boost };
  });

  scored.sort((a, b) => b.score - a.score);

  const featured = [...premiumServers];
  const remainingFeaturedCount = Math.max(
    0,
    options.featured - featured.length,
  );

  const additionalFeatured = scored
    .slice(0, remainingFeaturedCount)
    .map((x) => x.s);
  featured.push(...additionalFeatured);

  const featuredIds = new Set(featured.map((s) => s.id));
  const rest = scored.filter((x) => !featuredIds.has(x.s.id)).map((x) => x.s);

  const marqueeCount = options.marquee;
  const marquee =
    rest.length >= marqueeCount
      ? rest.slice(0, marqueeCount)
      : [...rest, ...featured].slice(0, marqueeCount);

  return { marquee, featured };
}
