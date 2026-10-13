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

/** Organic featured slots are drawn from the top (slots × this) by score. */
const FEATURED_POOL_MULTIPLIER = 4;

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
 * Pick homepage featured cards (paid listings only, when any exist) and the
 * marquee (engagement-ranked, with light randomness).
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

  const shuffle = <U>(items: U[]): U[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  // Paid listings (premium subscription or an active featured boost) own the
  // featured shelf outright. Shuffled per seed so that when there are more
  // paid listings than slots, each one gets turns instead of the first rows
  // in DB order permanently holding the shelf.
  const paid = shuffle(servers.filter((s) => isFeaturedListing(s)));

  const scored = servers
    .filter((s) => !isFeaturedListing(s))
    .map((s) => {
      const engagement =
        (s.upvotes || 0) * 5 + (s.copies || 0) + (s.views || 0) * 0.05;
      // Keep a modest nudge for official listings without letting it
      // dominate over genuine upvotes/copies/views.
      const boost = (s.isOfficial ? 150 : 0) + rand() * 120;
      return { s, score: engagement + boost };
    });
  scored.sort((a, b) => b.score - a.score);

  // Organic picks only backfill when nobody has paid; drawn from a wider top
  // pool so the same high-engagement listings don't freeze the shelf.
  const featured =
    paid.length > 0
      ? paid.slice(0, options.featured)
      : shuffle(scored.slice(0, options.featured * FEATURED_POOL_MULTIPLIER))
          .slice(0, options.featured)
          .map((x) => x.s);

  const featuredIds = new Set(featured.map((s) => s.id));
  const rest = [
    ...paid.filter((s) => !featuredIds.has(s.id)),
    ...scored.filter((x) => !featuredIds.has(x.s.id)).map((x) => x.s),
  ];

  const marqueeCount = options.marquee;
  const marquee =
    rest.length >= marqueeCount
      ? rest.slice(0, marqueeCount)
      : [...rest, ...featured].slice(0, marqueeCount);

  return { marquee, featured };
}
