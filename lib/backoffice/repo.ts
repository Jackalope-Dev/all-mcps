/**
 * Data access for the back-office adapter. An interface (not raw drizzle) so the
 * conformance test can run against an in-memory fake. `drizzleRepo` is the real
 * implementation; `lib/backoffice/adapter.test.ts` provides the fake.
 */

import { and, count, desc, eq, like, or } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { reports, servers, users } from '@/db/schema';

type DB = ReturnType<typeof drizzle>;

export interface ListArgs {
  search?: string;
  limit: number;
  filters?: Record<string, unknown>;
}

export interface Repo {
  users: {
    list(
      a: ListArgs,
    ): Promise<{ rows: Record<string, unknown>[]; total: number }>;
    get(id: string): Promise<Record<string, unknown> | null>;
  };
  servers: {
    list(
      a: ListArgs,
    ): Promise<{ rows: Record<string, unknown>[]; total: number }>;
    get(id: string): Promise<Record<string, unknown> | null>;
  };
  reports: {
    list(
      a: ListArgs,
    ): Promise<{ rows: Record<string, unknown>[]; total: number }>;
    get(id: string): Promise<Record<string, unknown> | null>;
    setStatus(
      id: string,
      status: 'reviewed' | 'dismissed',
    ): Promise<Record<string, unknown>>;
  };
  stats(): Promise<Record<string, number>>;
}

const iso = (v: unknown) =>
  v instanceof Date ? v.toISOString() : v == null ? null : String(v);

export function drizzleRepo(db: DB): Repo {
  return {
    users: {
      async list({ search, limit }) {
        const where = search
          ? or(
              like(users.email, `%${search}%`),
              like(users.name, `%${search}%`),
            )
          : undefined;
        const rows = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            emailVerified: users.emailVerified,
          })
          .from(users)
          .where(where)
          .limit(limit);
        return {
          rows: rows.map((r) => ({
            ...r,
            emailVerified: iso(r.emailVerified),
          })),
          total: rows.length,
        };
      },
      async get(id) {
        const [r] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            emailVerified: users.emailVerified,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, id))
          .limit(1);
        return r ? { ...r, emailVerified: iso(r.emailVerified) } : null;
      },
    },

    servers: {
      async list({ search, limit, filters }) {
        const clauses = [];
        if (search) clauses.push(like(servers.name, `%${search}%`));
        if (filters?.category)
          clauses.push(eq(servers.category, String(filters.category)));
        if (filters?.premiumStatus)
          clauses.push(
            eq(servers.premiumStatus, String(filters.premiumStatus)),
          );
        const rows = await db
          .select({
            id: servers.id,
            name: servers.name,
            category: servers.category,
            premiumStatus: servers.premiumStatus,
            isOfficial: servers.isOfficial,
            createdAt: servers.createdAt,
          })
          .from(servers)
          .where(clauses.length ? and(...clauses) : undefined)
          .orderBy(desc(servers.createdAt))
          .limit(limit);
        return {
          rows: rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
          total: rows.length,
        };
      },
      async get(id) {
        const [r] = await db
          .select({
            id: servers.id,
            name: servers.name,
            url: servers.url,
            category: servers.category,
            description: servers.description,
            premiumStatus: servers.premiumStatus,
            isOfficial: servers.isOfficial,
            ownerUserId: servers.ownerUserId,
            createdAt: servers.createdAt,
          })
          .from(servers)
          .where(eq(servers.id, id))
          .limit(1);
        return r ? { ...r, createdAt: iso(r.createdAt) } : null;
      },
    },

    reports: {
      async list({ limit, filters }) {
        const where = filters?.status
          ? eq(reports.status, String(filters.status))
          : undefined;
        const rows = await db
          .select()
          .from(reports)
          .where(where)
          .orderBy(desc(reports.createdAt))
          .limit(limit);
        return {
          rows: rows.map((r) => ({
            ...r,
            createdAt: iso(r.createdAt),
            reviewedAt: iso(r.reviewedAt),
          })),
          total: rows.length,
        };
      },
      async get(id) {
        const [r] = await db
          .select()
          .from(reports)
          .where(eq(reports.id, Number(id)))
          .limit(1);
        return r
          ? { ...r, createdAt: iso(r.createdAt), reviewedAt: iso(r.reviewedAt) }
          : null;
      },
      async setStatus(id, status) {
        await db
          .update(reports)
          .set({ status, reviewedAt: new Date() })
          .where(eq(reports.id, Number(id)));
        const row = await this.get(id);
        if (!row) throw new Error(`report ${id} not found`);
        return row;
      },
    },

    async stats() {
      const [u] = await db.select({ n: count() }).from(users);
      const [s] = await db.select({ n: count() }).from(servers);
      const [r] = await db
        .select({ n: count() })
        .from(reports)
        .where(eq(reports.status, 'open'));
      return {
        users: u?.n ?? 0,
        servers: s?.n ?? 0,
        openReports: r?.n ?? 0,
      };
    },
  };
}
