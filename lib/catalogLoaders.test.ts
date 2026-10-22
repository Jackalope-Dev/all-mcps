import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { servers as serversTable } from '@/db/schema';

/**
 * The bounded catalog loaders that replaced whole-catalog scans on category,
 * /best, random, llms-full.txt and index routes. Regression: with ~27k active
 * listings (~30MB tools JSON, ~15MB AI text) those routes hit exceededMemory,
 * e.g. /best/google-workspace. Runs the real queries against node:sqlite behind
 * a minimal D1 shim, as searchActiveServers.test.ts does.
 */

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
      async run() {
        sqlite.prepare(query).run(...(params as never[]));
        return { success: true, meta: {}, results: [] };
      },
    };
    return stmt;
  },
};

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({ env: { DB: d1Shim }, ctx: {} }),
}));

const { selectServersForTopic } = await import('./bestTopics');
const {
  getRankingCandidates,
  getRandomActiveServers,
  getRelatedServers,
  getServersForTopic,
  hydrateServersByIds,
  iterateActiveServers,
  iterateActiveServersLight,
} = await import('./servers');
const { getAllTagsWithCounts, getServersForTag } = await import('./tags');

const DEV = '💻 Developer Tools';
const COMMS = '💬 Communication';

const ROWS = [
  {
    id: 'a-gdrive',
    name: 'GDrive MCP',
    description: 'Google Drive access.',
    category: DEV,
  },
  {
    id: 'b-gmail',
    name: 'Gmail Agent',
    description: 'Read Google mail.',
    category: COMMS,
  },
  { id: 'c-git', name: 'Git Tools', description: 'Local git.', category: DEV },
  {
    id: 'd-googleplex',
    name: 'Googleplex Toys',
    description: 'Not the company.',
    category: DEV,
  },
  {
    id: 'e-removed',
    name: 'Old Google',
    description: 'Retired.',
    category: DEV,
    status: 'removed',
  },
  { id: 'f-slack', name: 'Slack', description: 'Chat.', category: COMMS },
];

beforeAll(() => {
  const cols = getTableConfig(serversTable).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  const insert = sqlite.prepare(
    `INSERT INTO servers (id, name, url, description, category, status, tools, ai_overview, ai_doc, github_stars, views, copies, upvotes, is_official)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0)`,
  );
  for (const r of ROWS) {
    insert.run(
      r.id,
      r.name,
      `https://github.com/example/${r.id}`,
      r.description,
      r.category,
      r.status ?? 'active',
      JSON.stringify([
        { name: 'do_thing', description: 'Does it', inputSchema: { big: 1 } },
      ]),
      'A long generated overview.',
      // Indexable (writeup + strong traction): related links only point at
      // listings search engines may index.
      'Our writeup.',
      1500,
    );
  }
});

const ids = (servers: Array<{ id: string }>) => servers.map((s) => s.id).sort();

describe('getRankingCandidates', () => {
  it('returns slim active rows for one category, without tools or AI text', async () => {
    const rows = await getRankingCandidates({ category: DEV });
    expect(ids(rows)).toEqual(['a-gdrive', 'c-git', 'd-googleplex']);
    expect(rows[0]).not.toHaveProperty('tools');
    expect(rows[0]).not.toHaveProperty('aiOverview');
  });

  it('prefilters by keyword in name or description, within the category', async () => {
    expect(ids(await getRankingCandidates({ keywords: ['google'] }))).toEqual([
      'a-gdrive',
      'b-gmail',
      'd-googleplex',
    ]);
    expect(
      ids(
        await getRankingCandidates({ category: COMMS, keywords: ['google'] }),
      ),
    ).toEqual(['b-gmail']);
  });
});

describe('getServersForTopic', () => {
  it('scopes a keyword topic to LIKE matches; the page keeps exact word matches', async () => {
    const topic = {
      slug: 'google-workspace',
      match: ['google'],
      title: 'Google Workspace',
      lead: '',
      faq: [],
    } as never;
    const rows = await getServersForTopic(topic);
    expect(ids(rows)).toEqual(['a-gdrive', 'b-gmail', 'd-googleplex']);
    expect(ids(selectServersForTopic(topic, rows))).toEqual([
      'a-gdrive',
      'b-gmail',
    ]);
  });
});

describe('hydrateServersByIds', () => {
  it('returns full rows in the requested order with tools trimmed', async () => {
    const rows = await hydrateServersByIds(['f-slack', 'a-gdrive']);
    expect(rows.map((s) => s.id)).toEqual(['f-slack', 'a-gdrive']);
    expect(rows[0].tools).toEqual([
      { name: 'do_thing', description: 'Does it' },
    ]);
  });
});

describe('iterateActiveServers', () => {
  it('pages through every active listing exactly once, in id order', async () => {
    const pages: string[][] = [];
    for await (const page of iterateActiveServers(2)) {
      pages.push(page.map((s) => s.id));
    }
    expect(pages).toEqual([
      ['a-gdrive', 'b-gmail'],
      ['c-git', 'd-googleplex'],
      ['f-slack'],
    ]);
  });
});

describe('getRandomActiveServers', () => {
  it('samples at most n active rows from the category', async () => {
    const rows = await getRandomActiveServers(2, COMMS);
    expect(rows.length).toBe(2);
    expect(ids(rows)).toEqual(['b-gmail', 'f-slack']);
  });
});

describe('iterateActiveServersLight', () => {
  it('pages through every servable listing once, as slim rows', async () => {
    const pages: string[][] = [];
    for await (const page of iterateActiveServersLight(2)) {
      pages.push(page.map((s) => s.id));
      expect(page[0]).not.toHaveProperty('tools');
      expect(page[0]).not.toHaveProperty('aiOverview');
    }
    expect(pages).toEqual([
      ['a-gdrive', 'b-gmail'],
      ['c-git', 'd-googleplex'],
      ['f-slack'],
    ]);
  });
});

describe('tag scans', () => {
  it('counts tags across every page of the catalog', async () => {
    const tags = await getAllTagsWithCounts();
    const count = (slug: string) => tags.find((t) => t.slug === slug)?.count;
    expect(count('developer-tools')).toBe(3);
    expect(count('communication')).toBe(2);
  });

  it('keeps only the matches for one tag', async () => {
    const { servers } = await getServersForTag('communication');
    expect(ids(servers)).toEqual(['b-gmail', 'f-slack']);
  });
});

describe('getRelatedServers', () => {
  it('ranks same-category listings first, tops up from other categories, and hydrates the winners', async () => {
    const [current] = await hydrateServersByIds(['a-gdrive']);
    const related = await getRelatedServers(current, 4);
    expect(ids(related.slice(0, 2))).toEqual(['c-git', 'd-googleplex']);
    expect(ids(related.slice(2))).toEqual(['b-gmail', 'f-slack']);
    // Full public rows for the winners, not the slim ranking rows.
    expect(related[0].aiOverview).toBe('A long generated overview.');
    expect(related[0].tools).toEqual([
      { name: 'do_thing', description: 'Does it' },
    ]);
  });

  it('stops at the same category when it fills the limit', async () => {
    const [current] = await hydrateServersByIds(['a-gdrive']);
    const related = await getRelatedServers(current, 2);
    expect(ids(related)).toEqual(['c-git', 'd-googleplex']);
  });
});
