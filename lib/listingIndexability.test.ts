import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/d1';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { servers } from '@/db/schema';
import {
  canonicalListingId,
  DUPLICATE_LISTINGS,
  type IndexabilityInput,
  indexableListingSql,
  isGenericSlug,
  isListingIndexable,
  isServerRowIndexable,
  listingIndexVerdict,
  SEARCH_TRAFFIC_LISTINGS,
} from './listingIndexability';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

const base: IndexabilityInput = {
  id: 'acme-mcp',
  name: 'Acme MCP',
  url: 'https://github.com/acme/acme-mcp',
  status: 'active',
  hasAiDoc: true,
  githubStars: 0,
  npmDownloads: 0,
  healthStatus: 'healthy',
  lastCommitAt: ago(10),
};
const live = { toolsSource: 'introspected' } as const;
const reason = (s: Partial<IndexabilityInput>) =>
  listingIndexVerdict({ ...base, ...s }).reason;

describe('listingIndexVerdict', () => {
  it('requires our own writeup', () => {
    expect(reason({ hasAiDoc: false, githubStars: 20000 })).toBe('no-writeup');
  });

  it('indexes strong traction without a verified run', () => {
    expect(reason({ githubStars: 999 })).toBe('low-signal');
    expect(reason({ githubStars: 1000 })).toBe('strong-traction');
    expect(reason({ npmDownloads: 20000 })).toBe('strong-traction');
  });

  it('needs stars AND proof it runs AND a live repo for ordinary traction', () => {
    expect(reason({ githubStars: 100 })).toBe('low-signal');
    expect(reason({ ...live })).toBe('low-signal');
    expect(reason({ githubStars: 100, ...live })).toBe('traction');
    expect(reason({ githubStars: 100, installNeedsConfig: new Date() })).toBe(
      'traction',
    );
    expect(reason({ githubStars: 100, remoteEndpointHealthy: 1 })).toBe(
      'traction',
    );
    // Dead repo: no commit in over a year.
    expect(reason({ githubStars: 100, ...live, lastCommitAt: ago(400) })).toBe(
      'low-signal',
    );
    // Unknown commit date (not GitHub-linked, or not measured yet) is fine.
    expect(reason({ githubStars: 100, ...live, lastCommitAt: null })).toBe(
      'traction',
    );
  });

  it('does not count npm downloads without real GitHub stars', () => {
    // The Nov 2026 thin set: 0-25 stars, 1-5k monthly downloads, verified run.
    expect(reason({ npmDownloads: 1000, ...live })).toBe('low-signal');
    expect(reason({ npmDownloads: 19999, githubStars: 9, ...live })).toBe(
      'low-signal',
    );
    expect(reason({ npmDownloads: 4999, githubStars: 50, ...live })).toBe(
      'low-signal',
    );
    expect(reason({ npmDownloads: 5000, githubStars: 10, ...live })).toBe(
      'traction',
    );
  });

  it('counts proof the server runs, not a README tool list', () => {
    expect(reason({ githubStars: 100, toolsSource: 'readme' })).toBe(
      'low-signal',
    );
  });

  it('keeps a remote endpoint seen healthy in the last 14 days through a blip', () => {
    const failedNow = { githubStars: 100, remoteEndpointHealthy: 0 };
    expect(reason({ ...failedNow, remoteEndpointHealthyAt: ago(3) })).toBe(
      'traction',
    );
    // Raw D1 rows carry epoch seconds.
    expect(
      reason({
        ...failedNow,
        remoteEndpointHealthyAt: Math.floor(ago(3).getTime() / 1000),
      }),
    ).toBe('traction');
    expect(reason({ ...failedNow, remoteEndpointHealthyAt: ago(15) })).toBe(
      'low-signal',
    );
    expect(reason(failedNow)).toBe('low-signal');
  });

  it('indexes Official and Verified-owner listings that have a writeup', () => {
    expect(reason({ isOfficial: true })).toBe('trusted');
    expect(reason({ ownerVerified: 1 })).toBe('trusted');
    expect(reason({ ownerVerified: true, hasAiDoc: false })).toBe('no-writeup');
  });

  it('indexes human submissions that run, unless they are a starless GitHub repo', () => {
    const hosted = {
      humanSubmitted: true,
      url: 'https://acme.example/mcp',
      remoteEndpointHealthy: true,
    };
    expect(reason(hosted)).toBe('submitted');
    expect(reason({ ...hosted, remoteEndpointHealthy: false })).toBe(
      'low-signal',
    );
    expect(reason({ ...hosted, healthStatus: 'offline' })).toBe('low-signal');
    // One-person batches of generated repos: GitHub, a few stars at most.
    expect(
      reason({ ...hosted, url: 'https://github.com/someone/mcp-credit-note' }),
    ).toBe('low-signal');
    expect(
      reason({
        ...hosted,
        url: 'https://github.com/someone/real-thing',
        githubStars: 10,
      }),
    ).toBe('submitted');
    expect(reason({ ...hosted, humanSubmitted: false })).toBe('low-signal');
  });

  it('noindexes generic slugs unless traction is strong or the listing is trusted', () => {
    const solid = { githubStars: 500, ...live };
    expect(
      reason({ ...solid, id: 'mcp-server-62', name: 'Clipform MCP' }),
    ).toBe('generic-slug');
    expect(reason({ ...solid, id: 'iris-2', name: 'Iris' })).toBe(
      'generic-slug',
    );
    expect(
      reason({ id: 'mcp-204', name: 'Sceneview MCP', githubStars: 1365 }),
    ).toBe('strong-traction');
    expect(
      reason({ id: 'mcp-158', name: 'Webflow MCP', isOfficial: true }),
    ).toBe('trusted');
  });

  it('noindexes archived repos, stale-flagged and non-active listings', () => {
    expect(reason({ githubStars: 20000, healthStatus: 'archived' })).toBe(
      'archived',
    );
    expect(reason({ githubStars: 20000, staleFlagged: true })).toBe('stale');
    expect(reason({ githubStars: 20000, status: 'pending' })).toBe(
      'not-active',
    );
  });

  it('noindexes duplicates and points them at the kept listing', () => {
    expect(reason({ id: 'posthog-posthog', githubStars: 40000 })).toBe(
      'duplicate',
    );
    expect(canonicalListingId('posthog-posthog')).toBe('posthog-mcp-server');
    expect(canonicalListingId('posthog-mcp-server')).toBe('posthog-mcp-server');
  });

  it('keeps listings that earned search impressions whatever else they lack', () => {
    expect(reason({ id: 'jobspipe', hasAiDoc: false })).toBe('search-traffic');
    // ...but never a stale-flagged or non-active one.
    expect(reason({ id: 'jobspipe', staleFlagged: true })).toBe('stale');
    expect(reason({ id: 'jobspipe', status: 'removed' })).toBe('not-active');
  });
});

describe('duplicate and search-traffic lists', () => {
  it('maps every duplicate to a listing that is not itself a duplicate', () => {
    for (const [dup, kept] of Object.entries(DUPLICATE_LISTINGS)) {
      expect(dup).not.toBe(kept);
      expect(DUPLICATE_LISTINGS[kept]).toBeUndefined();
      expect(SEARCH_TRAFFIC_LISTINGS.has(dup)).toBe(false);
    }
  });
});

describe('isGenericSlug', () => {
  it('flags numbered placeholders and collision suffixes the name lacks', () => {
    expect(isGenericSlug('mcp-291', 'extensiondev/mcp')).toBe(true);
    expect(isGenericSlug('server-7', 'Something')).toBe(true);
    expect(isGenericSlug('apick-ai-2', 'APICK AI')).toBe(true);
    expect(isGenericSlug('aws-mcp-server-3', 'AWS MCP Server')).toBe(true);
  });

  it('leaves real project names alone', () => {
    expect(isGenericSlug('mcp-server-12306', 'mcp-server-12306')).toBe(false);
    expect(isGenericSlug('gpt-image-2-5', 'GPT Image 2.5')).toBe(false);
    expect(isGenericSlug('web3-mcp', 'Web3 MCP')).toBe(false);
    expect(isGenericSlug('acme-mcp', 'Acme MCP')).toBe(false);
  });
});

describe('isServerRowIndexable', () => {
  it('reads a raw row: aiDoc text, staleFlaggedAt and the submitter email', () => {
    const row = {
      id: 'acme',
      name: 'Acme',
      url: 'https://acme.example/mcp',
      status: 'active',
      aiDoc: 'Our writeup.',
      remoteEndpointHealthy: true,
      healthStatus: 'healthy',
    };
    expect(isServerRowIndexable(row)).toBe(false);
    expect(isServerRowIndexable({ ...row, submitterEmail: 'a@b.c' })).toBe(
      true,
    );
    expect(isServerRowIndexable({ ...row, humanSubmitted: 1 })).toBe(true);
    expect(
      isServerRowIndexable({
        ...row,
        humanSubmitted: 1,
        staleFlaggedAt: new Date(),
      }),
    ).toBe(false);
    expect(
      isServerRowIndexable({ ...row, humanSubmitted: 1, aiDoc: '  ' }),
    ).toBe(false);
  });
});

/**
 * indexableListingSql must give the same answer as isListingIndexable: the
 * sitemap and page use the JS rule, hubs, IndexNow and llms.txt the SQL one.
 */
describe('indexableListingSql parity', () => {
  const sqlite = new DatabaseSync(':memory:');
  const d1Shim = {
    prepare(query: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...p: unknown[]) {
          params = p;
          return stmt;
        },
        async all() {
          return {
            results: sqlite.prepare(query).all(...(params as never[])),
          };
        },
        async raw() {
          return sqlite
            .prepare(query)
            .all(...(params as never[]))
            .map((row) => Object.values(row));
        },
      };
      return stmt;
    },
  };
  const cols = getTableConfig(servers).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);

  const sec = (d: Date) => Math.floor(d.getTime() / 1000);
  type Row = {
    id: string;
    name?: string;
    url?: string;
    aiDoc?: string | null;
    stars?: number | null;
    downloads?: number | null;
    toolsSource?: string | null;
    installNeedsConfig?: Date | null;
    remoteHealthy?: number | null;
    remoteHealthyAt?: Date | null;
    lastCommitAt?: Date | null;
    health?: string;
    official?: number;
    ownerVerified?: number;
    submitterEmail?: string | null;
    staleFlaggedAt?: Date | null;
  };
  const rows: Row[] = [
    { id: 'no-doc', aiDoc: null, stars: 50000 },
    { id: 'strong-stars', stars: 1000 },
    { id: 'strong-dl', downloads: 20000 },
    { id: 'traction', stars: 100, toolsSource: 'introspected' },
    { id: 'traction-no-run', stars: 100 },
    {
      id: 'traction-dead',
      stars: 100,
      toolsSource: 'introspected',
      lastCommitAt: ago(400),
    },
    {
      id: 'traction-no-commit',
      stars: 100,
      toolsSource: 'introspected',
      lastCommitAt: null,
    },
    {
      id: 'dl-low-stars',
      stars: 9,
      downloads: 19000,
      installNeedsConfig: new Date(),
    },
    { id: 'dl-ok', stars: 10, downloads: 5000, installNeedsConfig: new Date() },
    { id: 'readme-tools', stars: 500, toolsSource: 'readme' },
    {
      id: 'remote-recent',
      stars: 100,
      remoteHealthy: 0,
      remoteHealthyAt: ago(3),
    },
    {
      id: 'remote-old',
      stars: 100,
      remoteHealthy: 0,
      remoteHealthyAt: ago(20),
    },
    { id: 'archived', stars: 50000, health: 'archived' },
    { id: 'stale', stars: 50000, staleFlaggedAt: new Date() },
    { id: 'official', official: 1 },
    { id: 'owner', ownerVerified: 1 },
    {
      id: 'submitted-hosted',
      url: 'https://acme.example/mcp',
      submitterEmail: 'x@y.z',
      remoteHealthy: 1,
    },
    {
      id: 'submitted-offline',
      url: 'https://acme.example/mcp',
      submitterEmail: 'x@y.z',
      remoteHealthy: 1,
      health: 'offline',
    },
    {
      id: 'submitted-gh',
      url: 'https://github.com/a/b',
      submitterEmail: 'x@y.z',
      remoteHealthy: 1,
      stars: 3,
    },
    {
      id: 'submitted-gh-www',
      url: 'HTTPS://WWW.GITHUB.COM/a/b',
      submitterEmail: 'x@y.z',
      remoteHealthy: 1,
      stars: 3,
    },
    {
      id: 'submitted-gh-starred',
      url: 'https://github.com/a/b',
      submitterEmail: 'x@y.z',
      remoteHealthy: 1,
      stars: 10,
    },
    {
      id: 'submitted-no-run',
      url: 'https://acme.example/mcp',
      submitterEmail: 'x@y.z',
    },
    {
      id: 'mcp-server-62',
      name: 'Clipform MCP',
      stars: 500,
      toolsSource: 'introspected',
    },
    {
      id: 'mcp-server-12306',
      name: 'mcp-server-12306',
      stars: 500,
      toolsSource: 'introspected',
    },
    { id: 'mcp-204', name: 'Sceneview MCP', stars: 1365 },
    { id: 'mcp-158', name: 'Webflow MCP', official: 1 },
    { id: 'iris-2', name: 'Iris', stars: 500, toolsSource: 'introspected' },
    { id: 'iris-12', name: 'Iris', stars: 500, toolsSource: 'introspected' },
    {
      id: 'gpt-image-2-5',
      name: 'GPT Image 2.5',
      stars: 500,
      toolsSource: 'introspected',
    },
    { id: 'web3-12', name: 'Web3 12', stars: 500, toolsSource: 'introspected' },
    { id: 'server-7', name: 'Thing', stars: 500, toolsSource: 'introspected' },
    { id: 'posthog-posthog', stars: 40000 },
    { id: 'posthog-mcp-server', stars: 40000 },
    { id: 'jobspipe', aiDoc: null },
    { id: 'buildsyncinc-gibs-mcp', staleFlaggedAt: new Date() },
  ];
  const insert = sqlite.prepare(
    `INSERT INTO servers (id, name, url, status, ai_doc, github_stars, npm_downloads, tools_source, install_needs_config, remote_endpoint_healthy, remote_endpoint_healthy_at, last_commit_at, health_status, is_official, owner_verified, submitter_email, stale_flagged_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of rows) {
    insert.run(
      r.id,
      r.name ?? r.id,
      r.url ?? `https://github.com/example/${r.id}`,
      r.aiDoc === undefined ? 'Our writeup.' : r.aiDoc,
      r.stars ?? null,
      r.downloads ?? null,
      r.toolsSource ?? null,
      r.installNeedsConfig ? sec(r.installNeedsConfig) : null,
      r.remoteHealthy ?? null,
      r.remoteHealthyAt ? sec(r.remoteHealthyAt) : null,
      r.lastCommitAt === undefined
        ? sec(ago(10))
        : r.lastCommitAt
          ? sec(r.lastCommitAt)
          : null,
      r.health ?? 'healthy',
      r.official ?? 0,
      r.ownerVerified ?? 0,
      r.submitterEmail ?? null,
      r.staleFlaggedAt ? sec(r.staleFlaggedAt) : null,
    );
  }

  it('agrees with the JS rule on every row', async () => {
    const db = drizzle(d1Shim as never);
    const sqlRows = await db
      .select({
        id: servers.id,
        name: servers.name,
        url: servers.url,
        status: servers.status,
        aiDoc: servers.aiDoc,
        githubStars: servers.githubStars,
        npmDownloads: servers.npmDownloads,
        toolsSource: servers.toolsSource,
        installNeedsConfig: servers.installNeedsConfig,
        remoteEndpointHealthy: servers.remoteEndpointHealthy,
        remoteEndpointHealthyAt: servers.remoteEndpointHealthyAt,
        lastCommitAt: servers.lastCommitAt,
        healthStatus: servers.healthStatus,
        isOfficial: servers.isOfficial,
        ownerVerified: servers.ownerVerified,
        submitterEmail: servers.submitterEmail,
        staleFlaggedAt: servers.staleFlaggedAt,
        indexable: indexableListingSql(),
      })
      .from(servers);
    expect(sqlRows).toHaveLength(rows.length);
    const verdicts = Object.fromEntries(
      sqlRows.map(({ indexable, ...row }) => [
        row.id,
        { sql: Boolean(indexable), js: isServerRowIndexable(row) },
      ]),
    );
    for (const [id, v] of Object.entries(verdicts)) {
      expect({ id, verdict: v.sql }).toEqual({ id, verdict: v.js });
    }
    // Spot-check the expected outcomes, not just agreement.
    const indexed = Object.entries(verdicts)
      .filter(([, v]) => v.js)
      .map(([id]) => id)
      .sort();
    expect(indexed).toEqual(
      [
        'dl-ok',
        'gpt-image-2-5',
        'jobspipe',
        'mcp-158',
        'mcp-204',
        'mcp-server-12306',
        'official',
        'owner',
        'posthog-mcp-server',
        'remote-recent',
        'strong-dl',
        'strong-stars',
        'submitted-gh-starred',
        'submitted-hosted',
        'traction',
        'traction-no-commit',
        'web3-12',
      ].sort(),
    );
  });

  it('isListingIndexable is the verdict flag', () => {
    expect(isListingIndexable({ ...base, githubStars: 1000 })).toBe(true);
    expect(isListingIndexable(base)).toBe(false);
  });
});
