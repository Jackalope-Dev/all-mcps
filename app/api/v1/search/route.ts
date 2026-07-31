import { getActiveServers } from '@/lib/servers';
import { computeQualityScore } from '@/lib/qualityScore';
import { rankServers } from '@/lib/search';
import { logApiAccess, extractRequestMeta } from '@/lib/accessLog';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim() || '';
  const category = searchParams.get('category')?.toLowerCase().trim() || '';
  const limitParam = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(1, limitParam), 100);

  let servers = await getActiveServers();

  if (category) {
    servers = servers.filter((s) => s.category.toLowerCase() === category);
  }

  // Rank by relevance when a query is present (falls back to catalog order otherwise).
  if (query) {
    servers = rankServers(servers, query);
  }

  const results = servers.slice(0, limit).map((server) => {
    const installName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return {
      id: server.id,
      name: server.name,
      description: server.description,
      category: server.category,
      url: server.url,
      isOfficial: server.isOfficial,
      isVerifiedActive: server.isVerifiedActive,
      upvotes: server.upvotes || 0,
      githubStars: server.githubStars ?? null,
      npmDownloads: server.npmDownloads ?? null,
      qualityScore: computeQualityScore(server).score,
      installName,
      claudeConfigSnippet: {
        mcpServers: {
          [installName]: {
            command: 'npx',
            args: ['-y', installName],
          },
        },
      },
      detailUrl: `https://allmcps.com/mcp/${server.id}`,
      markdownUrl: `https://allmcps.com/mcp/${server.id}.md`,
    };
  });

  // Log search API access (best-effort, non-blocking)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cfCtx = await getCloudflareContext();
    if (cfCtx?.env && (cfCtx.env as any).DB) {
      const logDb = (await import('drizzle-orm/d1')).drizzle((cfCtx.env as any).DB);
      const meta = extractRequestMeta(request);
      cfCtx.ctx.waitUntil(logApiAccess(logDb, {
        serverId: null,
        endpoint: 'v1_search',
        methodOrTool: query || null,
        userAgent: meta.userAgent,
        ipCountry: meta.ipCountry,
      }));
    }
  } catch { /* logging is best-effort */ }

  return Response.json(
    {
      total: results.length,
      query: query || null,
      category: category || null,
      servers: results,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
