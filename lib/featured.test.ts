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

  it('fills the shelf with only paid listings when any exist', () => {
    const paid = [
      {
        id: 'p1',
        name: 'P1',
        description: '',
        category: 'dev',
        isPremium: true,
      },
      {
        id: 'p2',
        name: 'P2',
        description: '',
        category: 'dev',
        isPremium: true,
      },
      {
        id: 'p3',
        name: 'P3',
        description: '',
        category: 'dev',
        featuredUntil: new Date(Date.now() + 86_400_000),
      },
    ];
    for (let seed = 0; seed < 20; seed++) {
      const { featured } = pickDiscoveryServers([...servers, ...paid], {
        marquee: 15,
        featured: 3,
        seed,
      });
      expect(featured.map((s) => s.id).sort()).toEqual(['p1', 'p2', 'p3']);
    }
  });

  it('rotates paid listings when there are more than slots', () => {
    const paid = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      description: '',
      category: 'dev',
      isPremium: true,
    }));
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const { featured, marquee } = pickDiscoveryServers(
        [...servers, ...paid],
        { marquee: 15, featured: 3, seed },
      );
      expect(featured.every((s) => s.id.startsWith('p'))).toBe(true);
      for (const s of featured) seen.add(s.id);
      // Overflow paid listings still get marquee exposure.
      expect(marquee.filter((s) => s.id.startsWith('p'))).toHaveLength(2);
    }
    expect(seen.size).toBe(5);
  });

  it('ignores an expired featured boost', () => {
    const expired = {
      id: 'old',
      name: 'Old',
      description: '',
      category: 'dev',
      featuredUntil: new Date(Date.now() - 86_400_000),
    };
    const { featured } = pickDiscoveryServers([...servers, expired], {
      marquee: 15,
      featured: 3,
      seed: 1,
    });
    expect(featured.map((s) => s.id)).not.toContain('old');
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
