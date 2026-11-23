import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/d1';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { servers } from '@/db/schema';

/**
 * Test-only: an in-memory node:sqlite database behind a minimal D1 shim (the
 * same shim as lib/submitterBlocks.test.ts), with the tables the email gates
 * read: users (with its unique email index), servers, submitter_blocks.
 */
export function emailTestDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    "CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, name TEXT, email TEXT, email_verified INTEGER, image TEXT, role TEXT NOT NULL DEFAULT 'user')",
  );
  sqlite.exec('CREATE UNIQUE INDEX users_email_unique ON users (email)');
  const cols = getTableConfig(servers).columns.map((c) =>
    c.name === 'id' ? 'id TEXT PRIMARY KEY' : c.name,
  );
  sqlite.exec(`CREATE TABLE servers (${cols.join(', ')})`);
  const migration = readFileSync(
    new URL('../../drizzle/0074_submitter_blocks.sql', import.meta.url),
    'utf8',
  )
    .split('--> statement-breakpoint')
    .filter((s) => !/ALTER TABLE/.test(s));
  for (const stmt of migration) sqlite.exec(stmt);

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
  return { sqlite, shim, db: drizzle(shim as never) };
}

/** A Svix-style signature, computed the way Resend's sender does. */
export async function svixSign(
  secret: string,
  id: string,
  ts: number,
  body: string,
): Promise<string> {
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${ts}.${body}`),
  );
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}
