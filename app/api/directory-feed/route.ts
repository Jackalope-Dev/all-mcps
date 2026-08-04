import { getDirectoryFeedPage } from '@/lib/servers';

/**
 * Paginated client-side directory feed for the /browse grid. The browse page
 * server-renders only a small slice for initial paint + SEO; DirectoryGrid walks
 * this feed page-by-page on mount to power full catalog search/sort/filter
 * without shipping the whole catalog in the initial HTML (~1.5 MB+).
 *
 * Paging matters at scale: pulling every active listing's full AI-content columns
 * in one query loads several MB into the D1/Worker isolate and can trip D1's
 * per-query memory/CPU limits — which previously left the grid stuck on its
 * initial 60-item slice. Each page here stays small (lean columns, SQL-capped AI
 * text), and the response advertises `nextOffset` so the client knows when it has
 * assembled the entire catalog.
 *
 * Query params:
 *   - `offset` (default 0): row offset into the active catalog.
 *   - `limit`  (default 1000, max 1000): page size.
 */
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 1000;

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsedOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  const parsedLimit = Number.parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const { items, total } = await getDirectoryFeedPage(offset, limit);

  // Null once this page reaches the end of the catalog.
  const nextOffset = offset + items.length < total ? offset + items.length : null;

  return Response.json(
    { servers: items, total, offset, limit, nextOffset },
    {
      headers: {
        'Cache-Control': 'public, max-age=120, s-maxage=600',
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );
}
