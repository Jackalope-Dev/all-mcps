import { getActiveServers } from '@/lib/servers';

/**
 * Lightweight index for the on-site command palette (Cmd+K) and other
 * instant-search UI — not the public /api/v1/search contract, so it's
 * unversioned, uncached-by-callers, and not logged as external API access.
 * Trims each row to only what search/rendering needs.
 */
export async function GET() {
  const servers = await getActiveServers();

  const results = servers.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    logoUrl: s.logoUrl ?? null,
  }));

  return Response.json(
    { servers: results },
    { headers: { 'Cache-Control': 'private, max-age=120' } }
  );
}
