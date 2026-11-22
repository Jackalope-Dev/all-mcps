import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';

/**
 * Cloudflare D1 refuses a table with more than 100 columns ("too many columns
 * on sqlite_altertab_servers"), and only when the migration runs against
 * production. servers hit the cap in Nov 2026; new per-listing data goes in a
 * side table keyed on servers.id instead.
 */
const D1_MAX_COLUMNS = 100;

describe('D1 column cap', () => {
  const tables = (Object.values(schema) as unknown[]).filter(
    (v): v is SQLiteTable => v instanceof SQLiteTable,
  );

  it.each(
    tables.map((t) => [
      getTableConfig(t).name,
      getTableConfig(t).columns.length,
    ]),
  )('%s has at most 100 columns', (_name, count) => {
    expect(count).toBeLessThanOrEqual(D1_MAX_COLUMNS);
  });
});
