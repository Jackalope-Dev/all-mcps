import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { listingSignals } from '../db/schema';

export type ListingSignalValues = Partial<
  Omit<typeof listingSignals.$inferInsert, 'serverId'>
>;

/**
 * Insert-or-merge a listing's signals row. Only the given fields change, so
 * the sweep, the result route and the review paths can each write their own
 * columns without clobbering the others'.
 */
export function upsertSignals(
  db: DrizzleD1Database<any>,
  serverId: string,
  values: ListingSignalValues,
) {
  return db
    .insert(listingSignals)
    .values({ serverId, ...values })
    .onConflictDoUpdate({ target: listingSignals.serverId, set: values });
}
