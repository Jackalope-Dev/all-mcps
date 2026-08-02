import { getActiveServers } from '@/lib/servers';

/**
 * Full client-side directory feed for the /browse grid. The browse page server-
 * renders only a small slice for initial paint + SEO; DirectoryGrid fetches this
 * once on mount to power full catalog search/sort/filter without shipping the
 * entire catalog in the initial HTML (which was ~1.5 MB+).
 *
 * Returns exactly the fields the grid reads — descriptions (search + card body),
 * stats (sort), and the flags isFeaturedListing/isVerifiedListing need.
 */
export async function GET() {
  const servers = await getActiveServers();

  const feed = servers.map((s) => {
    // Compact tool names for client-side search (not full tool objects).
    const tools = Array.isArray(s.tools) ? s.tools : [];
    const toolText =
      tools
        .map((t) => (t && typeof t.name === 'string' ? t.name : ''))
        .filter(Boolean)
        .join(' ')
        .slice(0, 400) || null;

    return {
      id: s.id,
      name: s.name,
      url: s.url,
      description: s.description,
      category: s.category,
      logoUrl: s.logoUrl ?? null,
      isOfficial: !!s.isOfficial,
      isPremium: !!s.isPremium,
      featuredUntil: s.featuredUntil ?? null,
      githubStars: s.githubStars ?? null,
      npmDownloads: s.npmDownloads ?? null,
      toolText,
      views: s.views ?? 0,
      copies: s.copies ?? 0,
      upvotes: s.upvotes ?? 0,
      createdAt: s.createdAt ?? null,
    };
  });

  return Response.json(
    { servers: feed, total: feed.length },
    {
      headers: {
        'Cache-Control': 'public, max-age=120, s-maxage=600',
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );
}
