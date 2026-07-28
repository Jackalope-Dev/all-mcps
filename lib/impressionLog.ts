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
  | 'category_page';

/** Human-readable labels for impression surfaces (for dashboard display). */
export const SURFACE_LABELS: Record<ImpressionSurface, string> = {
  homepage_featured: 'Homepage Featured',
  homepage_marquee: 'Homepage Marquee',
  browse_list: 'Browse List',
  browse_grid: 'Browse Grid',
  search_results: 'Search Results',
  detail_sidebar: 'Detail Sidebar',
  category_page: 'Category Page',
};

type ImpressionParams = {
  serverId: string;
  surface: ImpressionSurface;
  sessionHash?: string | null;
};

/**
 * Insert a batch of impression log rows.
 * Designed to be called from the /api/impressions endpoint.
 */
export async function logImpressions(
  db: any,
  impressions: ImpressionParams[]
): Promise<void> {
  if (impressions.length === 0) return;

  // Batch insert — D1 supports multi-row inserts
  try {
    await db.insert(impressionLogs).values(
      impressions.map((imp) => ({
        serverId: imp.serverId,
        surface: imp.surface,
        sessionHash: imp.sessionHash || null,
      }))
    );
  } catch (err: any) {
    console.error('[impressionLog] Failed to insert batch:', err?.message);
  }
}
