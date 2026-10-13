import { describe, expect, it } from 'vitest';
import type { Server } from './servers';
import { isShowcaseEligible, rankShowcaseServers } from './showcase';

const base = (over: Partial<Server>): Server =>
  ({
    id: 'x',
    name: 'X',
    url: 'https://example.com/mcp',
    description: 'A well-described MCP server that does useful things.',
    category: 'Developer Tools',
    logoUrl: 'https://example.com/logo.png',
    ...over,
  }) as Server;

describe('showcase ranking', () => {
  it('excludes listings without a logo or that are dead', () => {
    expect(isShowcaseEligible(base({ logoUrl: null }))).toBe(false);
    expect(isShowcaseEligible(base({ healthStatus: 'archived' }))).toBe(false);
    expect(isShowcaseEligible(base({ description: 'tiny' }))).toBe(false);
    expect(isShowcaseEligible(base({}))).toBe(true);
  });

  it('ranks adopted listings above brand-new empty ones', () => {
    const fresh = base({ id: 'fresh', createdAt: new Date().toISOString() });
    const popular = base({
      id: 'popular',
      githubStars: 20000,
      npmDownloads: 500000,
      upvotes: 12,
      createdAt: '2025-01-01',
    });
    const ranked = rankShowcaseServers([fresh, popular], 2);
    expect(ranked.map((s) => s.id)).toEqual(['popular', 'fresh']);
  });
});
