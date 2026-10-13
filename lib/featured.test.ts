import { describe, expect, it } from 'vitest';
import { pickDiscoveryServers } from './featured';

const servers = Array.from({ length: 30 }, (_, i) => ({
  id: `s${i}`,
  name: `Server ${i}`,
  description: '',
  category: 'dev',
  // Steep engagement curve: the top two dwarf the random jitter.
  upvotes: i < 2 ? 1000 - i : 30 - i,
}));

describe('pickDiscoveryServers', () => {
  it('rotates organic featured picks across seeds', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const { featured } = pickDiscoveryServers(servers, {
        marquee: 15,
        featured: 3,
        seed,
      });
      expect(featured).toHaveLength(3);
      for (const s of featured) seen.add(s.id);
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  it('keeps premium and paid featured listings first', () => {
    const withPaid = [
      ...servers,
      {
        id: 'paid',
        name: 'Paid',
        description: '',
        category: 'dev',
        featuredUntil: new Date(Date.now() + 86_400_000),
      },
      {
        id: 'prem',
        name: 'Prem',
        description: '',
        category: 'dev',
        isPremium: true,
      },
    ];
    for (let seed = 0; seed < 20; seed++) {
      const { featured } = pickDiscoveryServers(withPaid, {
        marquee: 15,
        featured: 3,
        seed,
      });
      expect(featured.slice(0, 2).map((s) => s.id)).toEqual(['prem', 'paid']);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = pickDiscoveryServers(servers, {
      marquee: 15,
      featured: 3,
      seed: 7,
    });
    const b = pickDiscoveryServers(servers, {
      marquee: 15,
      featured: 3,
      seed: 7,
    });
    expect(a.featured.map((s) => s.id)).toEqual(b.featured.map((s) => s.id));
  });
});
