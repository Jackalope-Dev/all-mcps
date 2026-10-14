import { categorySlug, parseCategoryLabel } from '@/lib/categories';
import { recordSearchMiss } from '@/lib/searchMisses';
import {
  getCategoryCounts,
  hydrateServersByIds,
  searchActiveServers,
} from '@/lib/servers';

/**
 * Small on-site lookups for the command palette (Cmd+K), the stack builder and
 * the badge builder — not the public /api/v1/search contract, so it is
 * unversioned and not logged as external API access.
 *
 * It used to return every servable listing (id, name, description, summary)
 * in one response for the client to filter: megabytes on the first keystroke.
 * Now each caller asks for what it shows:
 *   - `?q=<text>&limit=8`   ranked matches (same ranker as the API; keyword
 *                           and typo passes, no embedding call per keystroke)
 *   - `?category=<name>`    with no q: the most-used listings in a category
 *   - `?ids=a,b,c`          specific listings (max 50), e.g. a saved stack
 *   - `?categories=1`       category names and counts for navigation
 */
const MAX_LIMIT = 20;
const MAX_IDS = 50;

type IndexedServer = {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl: string | null;
  aiSummary: string | null;
};

function toIndexed(s: {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  logoUrl?: string | null;
  aiSummary?: string | null;
}): IndexedServer {
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? '',
    category: s.category,
    logoUrl: s.logoUrl ?? null,
    aiSummary: s.aiSummary ?? null,
  };
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;

  if (sp.get('categories') === '1') {
    const counts = await getCategoryCounts();
    const categories = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        label: parseCategoryLabel(name).label,
        slug: categorySlug(name),
        count,
      }));
    return Response.json(
      { categories },
      { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
    );
  }

  const ids = (sp.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);
  if (ids.length > 0) {
    const servers = await hydrateServersByIds(ids);
    return Response.json(
      { servers: servers.map(toIndexed) },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } },
    );
  }

  const q = (sp.get('q') ?? '').trim().slice(0, 200);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(sp.get('limit') ?? '', 10) || 8),
  );
  const servers = await searchActiveServers({
    query: q,
    category: sp.get('category') || null,
    limit,
    vectorTopK: 0,
  });
  if (q && servers.length === 0) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = await getCloudflareContext();
      const env = ctx?.env as { DB?: unknown } | undefined;
      if (env?.DB) {
        const { drizzle } = await import('drizzle-orm/d1');
        await recordSearchMiss(drizzle(env.DB as any), q, 'palette');
      }
    } catch {
      // Logging a miss is best-effort.
    }
  }
  return Response.json(
    { servers: servers.map(toIndexed) },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } },
  );
}
