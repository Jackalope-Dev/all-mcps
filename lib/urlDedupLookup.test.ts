import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/d1';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { servers } from '@/db/schema';
import { findExistingListingByUrl } from './urlDedup';

/**
 * findExistingListingByUrl narrows rows in SQL with substring tests before
 * comparing normalized keys. Stored URLs the parser would rewrite (IDN hosts,
 * backslashes, dot segments) must still be found, so this runs against real
 * SQLite rather than a mock that matches anything.
 */
const sqlite = new DatabaseSync(':memory:');
const d1 = {
  prepare(query: string) {
    let params: unknown[] = [];
    const stmt = {
      bind(...p: unknown[]) {
        params = p;
        return stmt;
      },
      async all() {
        return { results: sqlite.prepare(query).all(...(params as never[])) };
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
const db = drizzle(d1 as any);

const STORED: Record<string, string> = {
  idn: 'https://müller.de/foo',
  backslash: String.raw`https://github.com\acme\tool`,
  dots: 'https://github.com/acme/./other',
};

beforeAll(() => {
  const cols = getTableConfig(servers).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  const insert = sqlite.prepare(
    "INSERT INTO servers (id, name, url, status) VALUES (?, ?, ?, 'active')",
  );
  for (const [id, url] of Object.entries(STORED)) insert.run(id, id, url);
});

describe('findExistingListingByUrl against real SQLite', () => {
  it('finds an IDN host stored as Unicode from its punycode form, and back', async () => {
    expect(
      (await findExistingListingByUrl(db, 'https://xn--mller-kva.de/foo'))?.id,
    ).toBe('idn');
    expect(
      (await findExistingListingByUrl(db, 'https://müller.de/foo'))?.id,
    ).toBe('idn');
  });

  it('finds stored URLs the parser rewrites', async () => {
    expect(
      (await findExistingListingByUrl(db, 'https://github.com/acme/tool'))?.id,
    ).toBe('backslash');
    expect(
      (await findExistingListingByUrl(db, 'https://github.com/acme/other'))?.id,
    ).toBe('dots');
  });

  it('still reports no match for a new URL', async () => {
    expect(
      await findExistingListingByUrl(db, 'https://github.com/acme/new'),
    ).toBeNull();
  });
});
