import { sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { searchMisses } from '../db/schema';

/**
 * Searches that found nothing, counted per normalized query in search_misses.
 * They are the clearest signal of what the catalog is missing; the admin
 * "Demand gaps" list reads them. Nothing about the visitor is stored.
 */
export type SearchMissSurface = 'browse' | 'api' | 'mcp' | 'palette';

const MIN_LENGTH = 3;
const MAX_LENGTH = 120;

/** Lowercased, trimmed, single-spaced; null when too short or long to be worth keeping. */
export function normalizeMissQuery(raw: string): string | null {
  const q = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (q.length < MIN_LENGTH || q.length > MAX_LENGTH) return null;
  // All punctuation or digits is noise, not demand.
  if (!/[a-z]/.test(q)) return null;
  return q;
}

/** Best-effort upsert; a failure never affects the search response. */
export async function recordSearchMiss(
  db: ReturnType<typeof drizzle>,
  rawQuery: string,
  surface: SearchMissSurface,
  now = new Date(),
): Promise<void> {
  const query = normalizeMissQuery(rawQuery);
  if (!query) return;
  try {
    await db
      .insert(searchMisses)
      .values({ query, surface, count: 1, firstSeenAt: now, lastSeenAt: now })
      .onConflictDoUpdate({
        target: searchMisses.query,
        set: {
          count: sql`${searchMisses.count} + 1`,
          surface,
          lastSeenAt: now,
        },
      });
  } catch {
    // Table not migrated yet, or D1 busy: drop the sample.
  }
}
