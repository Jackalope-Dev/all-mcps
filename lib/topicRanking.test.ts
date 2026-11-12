import { describe, expect, it } from 'vitest';
import { type BestTopic, selectServersForTopic } from './bestTopics';
import { DEFAULT_SUBMIT_CATEGORY } from './categories';
import type { Server } from './servers';
import { hubReason, rankServersForTopic } from './topicRanking';

const DB = '🗄️ Databases';
const MEDIA = '🎥 Multimedia Process';

const postgres: BestTopic = {
  slug: 'postgres',
  match: ['postgres', 'postgresql'],
  title: 'PostgreSQL',
  lead: 'x',
  faq: [],
};

function row(overrides: Partial<Server>): Server {
  return {
    id: overrides.name ?? 'id',
    name: 'x',
    url: 'https://github.com/a/b',
    description: '',
    category: DB,
    ...overrides,
  } as Server;
}

describe('selectServersForTopic (keyword hubs)', () => {
  const servers = [
    row({ name: 'postgres-mcp', category: DB }),
    row({ name: 'PostgreSQL Server', category: DB }),
    row({ name: 'pg-postgres-tools', category: DB }),
    row({ name: 'Dbhub', description: 'Database MCP for PostgreSQL, MySQL' }),
    row({
      name: 'Douyin Downloader',
      description: 'Video downloader with a PostgreSQL archive',
      category: MEDIA,
    }),
    row({
      name: 'SSH Manager',
      description: 'SSH tools, database dump (PostgreSQL)',
      category: DEFAULT_SUBMIT_CATEGORY,
    }),
  ];

  it('keeps name matches and description matches in a home category', () => {
    const names = selectServersForTopic(postgres, servers).map((s) => s.name);
    expect(names).toEqual([
      'postgres-mcp',
      'PostgreSQL Server',
      'pg-postgres-tools',
      'Dbhub',
    ]);
  });

  it('matches the repo part of a name, not a registry prefix or owner', () => {
    const github: BestTopic = {
      ...postgres,
      slug: 'github',
      match: ['github'],
    };
    const VC = '🔄 Version Control';
    const rows = [
      row({ name: 'github/github-mcp-server', category: VC }),
      row({ name: 'github-issues', category: VC }),
      row({ name: 'octo/github-actions-mcp', category: VC }),
      row({
        name: 'io.github.PhilipAD/health-export-mcp',
        description: 'Apple Health metrics',
        category: DEFAULT_SUBMIT_CATEGORY,
      }),
      row({
        name: 'tadas-github/a2asearch-mcp',
        description: 'Search MCP servers on GitHub',
        category: DEFAULT_SUBMIT_CATEGORY,
      }),
    ];
    expect(selectServersForTopic(github, rows).map((s) => s.name)).toEqual([
      'github/github-mcp-server',
      'github-issues',
      'octo/github-actions-mcp',
    ]);
  });

  it('falls back to any mention when there are too few name matches', () => {
    const few = [servers[0], servers[3], servers[4]];
    expect(selectServersForTopic(postgres, few)).toHaveLength(3);
  });
});

describe('rankServersForTopic', () => {
  it('puts a server we saw run above a slightly more popular unverified one', () => {
    const ranked = rankServersForTopic(postgres, [
      row({ name: 'postgres-a', githubStars: 300 }),
      row({
        name: 'postgres-b',
        githubStars: 200,
        toolsSource: 'introspected',
      }),
      row({ name: 'postgres-c', githubStars: 10 }),
    ]);
    expect(ranked.map((s) => s.name)).toEqual([
      'postgres-b',
      'postgres-a',
      'postgres-c',
    ]);
  });
});

describe('hubReason', () => {
  it('states only what we observed', () => {
    expect(
      hubReason(row({ toolsSource: 'introspected', githubStars: 3829 })),
    ).toBe('Tools confirmed live over MCP · 3,829 GitHub stars');
    expect(
      hubReason(
        row({ installNeedsConfig: new Date('2026-11-01'), githubStars: 5 }),
      ),
    ).toBe('Starts in our sandbox (needs your API keys)');
  });

  it('never claims popularity it does not have', () => {
    expect(hubReason(row({ copies: 0, upvotes: 0, githubStars: 3 }))).toBe(
      'Matches this topic; not yet verified by us',
    );
  });
});
