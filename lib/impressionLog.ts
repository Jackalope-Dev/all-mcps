/**
 * Impression logging — records where MCP listings appear on the site
 * so Premium owners can see their full impression funnel.
 */
import { impressionLogs } from '@/db/schema';

export type ImpressionSurface =
  | 'homepage_featured'
  | 'homepage_marquee'
  | 'browse_list'
  | 'browse_grid'
  | 'search_results'
  | 'detail_sidebar'
  | 'category_page'
  | 'outbound_github'
  | 'outbound_website';

/** Human-readable labels for impression surfaces (for dashboard display). */
export const SURFACE_LABELS: Record<ImpressionSurface, string> = {
  homepage_featured: 'Homepage Featured',
  homepage_marquee: 'Homepage Marquee',
  browse_list: 'Browse List',
  browse_grid: 'Browse Grid',
  search_results: 'Search Results',
  detail_sidebar: 'Detail Sidebar',
  category_page: 'Category Page',
  outbound_github: 'Repository Clicks',
  outbound_website: 'Website Clicks',
};

type ImpressionParams = {
  serverId: string;
  surface: ImpressionSurface;
  sessionHash?: string | null;
};

// D1 caps bound parameters at 100 per query. Each row binds 4 values
// (serverId, surface, sessionHash, createdAt), so 20 rows per insert (80 params)
// stays safely clear of D1's 100 parameter ceiling and avoids Drizzle
// defaulting auto-increment id to null in multi-row column list inference.
const MAX_ROWS_PER_INSERT = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Insert a batch of impression log rows.
 * Designed to be called from the /api/impressions endpoint.
 */
export async function logImpressions(
  db: any,
  impressions: ImpressionParams[]
): Promise<void> {
  if (impressions.length === 0) return;

  for (const batch of chunk(impressions, MAX_ROWS_PER_INSERT)) {
    try {
      await db.insert(impressionLogs).values(
        batch.map((imp) => ({
          serverId: imp.serverId,
          surface: imp.surface,
          sessionHash: imp.sessionHash || null,
          createdAt: new Date(),
        }))
      );
    } catch (err: any) {
      console.error('[impressionLog] Failed to insert batch:', err?.message);
    }
  }
}
