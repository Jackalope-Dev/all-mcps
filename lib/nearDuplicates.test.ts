import { describe, expect, it } from 'vitest';
import {
  type DedupeRow,
  findDuplicateClusters,
  sameRepo,
} from './nearDuplicates';

const NOW = new Date('2026-10-14T00:00:00Z');

function row(over: Partial<DedupeRow> & { id: string }): DedupeRow {
  return {
    name: over.id,
    url: `https://github.com/acme/${over.id}`,
    websiteUrl: null,
    status: 'active',
    views: 0,
    copies: 0,
    upvotes: 0,
    githubStars: 0,
    npmDownloads: 0,
    isOfficial: false,
    isPremium: false,
    createdAt: new Date('2026-01-01'),
    aiEnrichedAt: null,
    ownerUserId: null,
    featuredUntil: null,
    ...over,
  };
}

describe('sameRepo', () => {
  it('matches the same repo directory, ignoring case, .git and the ref', () => {
    expect(
      sameRepo('https://github.com/a/b', 'https://github.com/A/b.git'),
    ).toBe(true);
    expect(
      sameRepo(
        'https://github.com/a/b/tree/main/src/x',
        'https://github.com/a/b/tree/master/src/x/',
      ),
    ).toBe(true);
  });

  it('keeps different servers in one monorepo apart', () => {
    expect(
      sameRepo(
        'https://github.com/awslabs/mcp/tree/main/src/aws-docs',
        'https://github.com/awslabs/mcp/tree/main/src/cdk',
      ),
    ).toBe(false);
    expect(
      sameRepo(
        'https://github.com/a/b',
        'https://github.com/a/b/tree/main/packages/mcp',
      ),
    ).toBe(false);
  });

  it('never treats a same-named repo under another owner as the same', () => {
    expect(
      sameRepo(
        'https://github.com/someone/notion-mcp-server',
        'https://github.com/makenotion/notion-mcp-server',
      ),
    ).toBe(false);
    expect(sameRepo('https://github.com/a/b', 'https://gitlab.com/a/b')).toBe(
      false,
    );
    expect(sameRepo('https://github.com/a/b', 'https://github.com/a/c')).toBe(
      false,
    );
  });
});

describe('findDuplicateClusters', () => {
  it('auto-retires a same-repo duplicate and keeps the stronger row', () => {
    const clusters = findDuplicateClusters(
      [
        row({
          id: 'widgets',
          url: 'https://github.com/me/widgets',
          upvotes: 3,
        }),
        row({ id: 'widgets-2', url: 'https://github.com/me/widgets/' }),
        row({ id: 'unrelated' }),
      ],
      NOW,
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].tier).toBe('auto');
    expect(clusters[0].keeper.id).toBe('widgets');
    expect(clusters[0].losers.map((l) => l.id)).toEqual(['widgets-2']);
  });

  it('sends same name + website with different repos to review', () => {
    const clusters = findDuplicateClusters(
      [
        row({
          id: 'postey',
          name: 'Postey',
          url: 'https://github.com/p/one',
          websiteUrl: 'https://postey.ai',
        }),
        row({
          id: 'postey-2',
          name: 'Postey',
          url: 'https://github.com/p/two',
          websiteUrl: 'https://www.postey.ai/',
        }),
      ],
      NOW,
    );
    expect(clusters.map((c) => c.tier)).toEqual(['review']);
  });

  it('sends monorepo siblings and cross-owner namesakes to review', () => {
    const monorepo = findDuplicateClusters(
      [
        row({
          id: 'aws-docs',
          name: 'mcp',
          url: 'https://github.com/awslabs/mcp/tree/main/src/aws-docs',
          websiteUrl: 'https://awslabs.github.io/mcp',
          views: 100,
        }),
        row({
          id: 'aws-cdk',
          name: 'mcp',
          url: 'https://github.com/awslabs/mcp/tree/main/src/cdk',
          websiteUrl: 'https://awslabs.github.io/mcp',
        }),
      ],
      NOW,
    );
    expect(monorepo.map((c) => c.tier)).toEqual(['review']);
    const namesake = findDuplicateClusters(
      [
        row({
          id: 'notion',
          name: 'Notion MCP Server',
          url: 'https://github.com/makenotion/notion-mcp-server',
          websiteUrl: 'https://notion.so',
        }),
        row({
          id: 'notion-2',
          name: 'Notion MCP Server',
          url: 'https://github.com/someone/notion-mcp-server',
          websiteUrl: 'https://notion.so',
          views: 900,
        }),
      ],
      NOW,
    );
    expect(namesake.map((c) => c.tier)).toEqual(['review']);
  });

  it('never auto-retires a claimed, premium or featured loser', () => {
    for (const extra of [
      { ownerUserId: 'u1' },
      { isPremium: true, status: 'pending' },
      { featuredUntil: new Date('2026-12-01'), status: 'pending' },
    ]) {
      const clusters = findDuplicateClusters(
        [
          row({ id: 'w', url: 'https://github.com/me/w', upvotes: 50 }),
          row({ id: 'w-2', url: 'https://github.com/me/w.git', ...extra }),
        ],
        NOW,
      );
      expect(clusters[0].tier, JSON.stringify(extra)).toBe('review');
    }
  });

  it('skips clusters whose other members are already removed, and known non-duplicates', () => {
    expect(
      findDuplicateClusters(
        [
          row({ id: 'a', url: 'https://github.com/x/a' }),
          row({ id: 'a-2', url: 'https://github.com/x/a', status: 'removed' }),
        ],
        NOW,
      ),
    ).toEqual([]);
    expect(
      findDuplicateClusters(
        [
          row({
            id: 'agent-memory',
            name: 'Agishub',
            url: 'https://github.com/agishub/agishub-mcp',
            websiteUrl: 'https://agishub.com',
          }),
          row({
            id: 'mcp-57',
            name: 'Agishub',
            url: 'https://github.com/agishub/agishub',
            websiteUrl: 'https://agishub.com',
          }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it('prefers the active row over a more popular pending one, then the older', () => {
    const [c1] = findDuplicateClusters(
      [
        row({
          id: 'p',
          url: 'https://github.com/o/r',
          status: 'pending',
          upvotes: 99,
        }),
        row({ id: 'a', url: 'https://github.com/o/r' }),
      ],
      NOW,
    );
    expect(c1.keeper.id).toBe('a');
    const [c2] = findDuplicateClusters(
      [
        row({
          id: 'new',
          url: 'https://github.com/o/s',
          createdAt: new Date('2026-05-01'),
        }),
        row({
          id: 'old',
          url: 'https://github.com/o/s',
          createdAt: new Date('2026-02-01'),
        }),
      ],
      NOW,
    );
    expect(c2.keeper.id).toBe('old');
  });
});
