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
    tools: [{ name: 'do_thing', description: 'Does the thing.' }],
    ...over,
  }) as Server;

describe('showcase ranking', () => {
  it('excludes listings without a logo or that are dead', () => {
    expect(isShowcaseEligible(base({ logoUrl: null }))).toBe(false);
    expect(isShowcaseEligible(base({ healthStatus: 'archived' }))).toBe(false);
    expect(isShowcaseEligible(base({ description: 'tiny' }))).toBe(false);
    expect(isShowcaseEligible(base({ tools: [] }))).toBe(false);
    expect(isShowcaseEligible(base({}))).toBe(true);
  });

  it('excludes the protocol reference servers despite their monorepo stars', () => {
    for (const url of [
      'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
      'https://github.com/modelcontextprotocol/servers-archived/tree/main/src/slack',
    ]) {
      expect(isShowcaseEligible(base({ url, githubStars: 91405 }))).toBe(false);
    }
    expect(
      isShowcaseEligible(
        base({ url: 'https://github.com/modelcontextprotocol/servers-kit' }),
      ),
    ).toBe(true);
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

  it('shows one listing per GitHub repo, the best-scoring one', () => {
    const monorepo = (id: string, upvotes: number) =>
      base({
        id,
        url: `https://github.com/Acme/Kit/tree/main/servers/${id}`,
        githubStars: 5000,
        upvotes,
      });
    const ranked = rankShowcaseServers(
      [monorepo('a', 1), monorepo('b', 9), base({ id: 'solo' })],
      3,
    );
    expect(ranked.map((s) => s.id)).toEqual(['b', 'solo']);
  });
});
