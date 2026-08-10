import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../db/schema';

/**
 * Same normalization as scripts/ingest-sources.mjs's normalizeUrlKey — kept in
 * sync deliberately so "already in the catalog" means the same thing whether
 * a listing arrived via a human submission or the registry-sync ingest.
 */
export function normalizeUrlKey(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const p = u.pathname.replace(/\.git$/i, '').replace(/\/+$/, '');
    return `${u.hostname.toLowerCase()}${p.toLowerCase()}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export type ExistingListingMatch = {
  id: string;
  name: string;
  status: string;
};

/**
 * Checks whether `url` already matches an existing listing's primary URL —
 * regardless of that listing's status, so a 'removed' (dead-link) or
 * 'pending' row still counts as "already here" and blocks a duplicate
 * submission instead of silently creating a second row for the same server.
 * Full-table scan of (id, name, url) is fine here: called from a low-frequency,
 * user-initiated path, not a hot loop.
 */
export async function findExistingListingByUrl(
  db: ReturnType<typeof drizzle>,
  url: string
): Promise<ExistingListingMatch | null> {
  const key = normalizeUrlKey(url);
  const rows = await db.select({ id: servers.id, name: servers.name, url: servers.url, status: servers.status }).from(servers);
  const match = rows.find((r) => normalizeUrlKey(r.url) === key);
  return match ? { id: match.id, name: match.name, status: match.status } : null;
}
