/**
 * Drizzle-backed AuditStore for the back-office adapter. Writes to `admin_audit`
 * (migration 0047). before/after are JSON-serialized.
 */

import { desc } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { adminAudit } from '@/db/schema';
import type { AuditStore } from './kit/adapter';
import type { AuditEvent } from './kit/contract';

type DB = ReturnType<typeof drizzle>;

const enc = (v: unknown) =>
  v === undefined || v === null ? null : JSON.stringify(v);
const dec = (v: string | null) => {
  if (v == null) return undefined;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

export function drizzleAuditStore(db: DB): AuditStore {
  return {
    async write(e: AuditEvent) {
      await db.insert(adminAudit).values({
        id: e.id,
        connectorId: e.connectorId,
        actorId: e.actorId,
        requestId: e.requestId,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        before: enc(e.before),
        after: enc(e.after),
        createdAt: new Date(e.createdAt),
      });
    },
    async list(q) {
      const rows = await db
        .select()
        .from(adminAudit)
        .orderBy(desc(adminAudit.createdAt))
        .limit(q.limit ?? 100);
      return {
        rows: rows.map((r) => ({
          id: r.id,
          connectorId: r.connectorId,
          actorId: r.actorId,
          requestId: r.requestId,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          before: dec(r.before),
          after: dec(r.after),
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : new Date(r.createdAt).toISOString(),
        })),
      };
    },
  };
}
