import { describe, expect, it } from 'vitest';
import { qualityMultiplier, rankServers } from './search';

describe('qualityMultiplier', () => {
  it('lifts listings we saw run and sinks dead ones', () => {
    expect(qualityMultiplier({})).toBe(1);
    expect(qualityMultiplier({ toolsSource: 'introspected' })).toBeCloseTo(
      1.15,
    );
    expect(qualityMultiplier({ installNeedsConfig: new Date() })).toBeCloseTo(
      1.15,
    );
    expect(qualityMultiplier({ healthStatus: 'archived' })).toBeCloseTo(0.6);
    expect(qualityMultiplier({ healthStatus: 'offline' })).toBeCloseTo(0.5);
  });

  it('lifts Official a little, owner-verified less, never both', () => {
    expect(qualityMultiplier({ isOfficial: true })).toBeCloseTo(1.1);
    expect(qualityMultiplier({ ownerVerified: 1 })).toBeCloseTo(1.05);
    expect(
      qualityMultiplier({ isOfficial: true, ownerVerified: true }),
    ).toBeCloseTo(1.1);
    expect(
      qualityMultiplier({ isOfficial: 1, toolsSource: 'introspected' }),
    ).toBeCloseTo(1.1 * 1.15);
  });

  it('breaks a relevance tie toward the working listing', () => {
    const ranked = rankServers(
      [
        {
          name: 'Postgres Tools',
          description: 'db',
          category: 'Databases',
          healthStatus: 'offline',
        },
        {
          name: 'Postgres Tools',
          description: 'db',
          category: 'Databases',
          toolsSource: 'introspected',
        },
      ],
      'postgres',
    );
    expect(ranked[0].toolsSource).toBe('introspected');
  });
});

describe('trust lift in rankServers', () => {
  const base = { description: 'Workspace pages', category: 'Productivity' };

  it('settles a near-tie toward Official, then owner-verified', () => {
    const ranked = rankServers(
      [
        { ...base, name: 'Notion Pages', id: 'plain', views: 500 },
        { ...base, name: 'Notion Tools', id: 'owner', ownerVerified: true },
        { ...base, name: 'Notion MCP', id: 'official', isOfficial: true },
      ],
      'notion',
    );
    expect(ranked.map((s) => s.id)).toEqual(['official', 'owner', 'plain']);
  });

  it('never lifts Official over a clearly better text match', () => {
    // An exact-name wrapper beats the vendor's prefix match, even when the
    // vendor's endpoint is healthy and the wrapper's is unknown.
    const exact = rankServers(
      [
        {
          ...base,
          name: 'Notion MCP Server',
          id: 'vendor',
          isOfficial: true,
          remoteEndpointHealthy: true,
        },
        { ...base, name: 'Notion', id: 'wrapper' },
      ],
      'notion',
    );
    expect(exact[0].id).toBe('wrapper');

    // A name hit beats a description-only hit on an Official listing.
    const nameHit = rankServers(
      [
        {
          name: 'Workspace Helper',
          description: 'Search notion pages',
          category: 'Productivity',
          id: 'vendor',
          isOfficial: true,
        },
        { ...base, name: 'Notion Search', id: 'other' },
      ],
      'notion',
    );
    expect(nameHit[0].id).toBe('other');
  });

  it('ignores paid status', () => {
    const ranked = rankServers(
      [
        { ...base, name: 'Notion Pages', id: 'paid', isPremium: true },
        { ...base, name: 'Notion Pages', id: 'free', upvotes: 1 },
      ],
      'notion',
    );
    // Same text, no trust: engagement decides, not Premium.
    expect(ranked.map((s) => s.id)).toEqual(['free', 'paid']);
  });
});
