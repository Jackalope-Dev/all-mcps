import { getActiveServers } from '@/lib/servers';
import { categorySlug, parseCategoryLabel } from '@/lib/categories';

/**
 * Lightweight index for the on-site command palette (Cmd+K) and other
 * instant-search UI — not the public /api/v1/search contract, so it's
 * unversioned, uncached-by-callers, and not logged as external API access.
 * Trims each row to only what search/rendering needs, and includes an
 * aggregated category list so the palette can offer category navigation
 * without pulling the full catalog JSON into the client bundle.
 */
export async function GET() {
  const servers = await getActiveServers();

  const results = servers.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    logoUrl: s.logoUrl ?? null,
    // Clean one-line AI summary (when enriched) — powers intent matching in the
    // command palette without shipping the full AI content into the client.
    aiSummary: s.aiSummary ?? null,
  }));

  const counts = new Map<string, number>();
  for (const s of servers) counts.set(s.category, (counts.get(s.category) || 0) + 1);
  const categories = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      label: parseCategoryLabel(name).label,
      slug: categorySlug(name),
      count,
    }));

  return Response.json(
    { servers: results, categories },
    { headers: { 'Cache-Control': 'private, max-age=120' } }
  );
}
