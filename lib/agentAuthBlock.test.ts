import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/d1';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { agentTokens, submitterBlocks, users } from '@/db/schema';
import { resolveAgentAuth, sha256Hex } from './agentAuth';

/** node:sqlite behind a minimal D1 shim (same as lib/aiContentQueue.test.ts). */
function d1Over(sqlite: DatabaseSync) {
  const shim = {
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
  return drizzle(shim as never);
}

function createTable(sqlite: DatabaseSync, table: SQLiteTable) {
  const { name, columns } = getTableConfig(table);
  sqlite.exec(
    `CREATE TABLE ${name} (${columns.map((c) => c.name).join(', ')})`,
  );
}

describe('agent tokens of a blocked owner', () => {
  it('stop resolving once the owner email or domain is blocked', async () => {
    const sqlite = new DatabaseSync(':memory:');
    for (const t of [users, agentTokens, submitterBlocks])
      createTable(sqlite, t);
    const token = 'amcp_test_token';
    sqlite
      .prepare('INSERT INTO users (id, email) VALUES (?, ?)')
      .run('u1', 'bot@spam-farm.dev');
    sqlite
      .prepare(
        'INSERT INTO agent_tokens (id, user_id, token_hash, expires_at, scopes) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        't1',
        'u1',
        await sha256Hex(token),
        Math.floor(Date.now() / 1000) + 86_400,
        '["listings:claim"]',
      );
    const db = d1Over(sqlite);
    const auth = () => resolveAgentAuth(db, `Bearer ${token}`);

    expect(await auth()).toMatchObject({ userId: 'u1' });

    sqlite
      .prepare(
        'INSERT INTO submitter_blocks (kind, value, created_at) VALUES (?, ?, 0)',
      )
      .run('domain', 'spam-farm.dev');
    expect(await auth()).toBeNull();
  });
});
