import { extractRequestMeta, logApiAccess } from '@/lib/accessLog';
import { computeQualityScore } from '@/lib/qualityScore';
import {
  checkRateLimit,
  clientKey,
  rateLimitedResponse,
  rateLimitHeaders,
} from '@/lib/rateLimit';
import { fetchServerReadme, getServerById } from '@/lib/servers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimit = checkRateLimit(
    `v1_server_detail:${clientKey(request)}`,
    60,
    60,
  );
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  const { id } = await params;
  const server = await getServerById(id);

  if (!server) {
    return Response.json(
      { error: 'not_found', message: `No listing exists with id "${id}".` },
      {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          ...rateLimitHeaders(rateLimit),
        },
      },
    );
  }

  const readme = await fetchServerReadme(server.url);
  const installName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const quality = computeQualityScore(server);

  // Log access (best-effort) so premium owners can see agent/LLM traffic per listing.
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cfCtx = await getCloudflareContext();
    if (cfCtx?.env && (cfCtx.env as any).DB) {
      const logDb = (await import('drizzle-orm/d1')).drizzle(
        (cfCtx.env as any).DB,
      );
      const meta = extractRequestMeta(request);
      cfCtx.ctx.waitUntil(
        logApiAccess(logDb, {
          serverId: server.id,
          endpoint: 'v1_server_detail',
          userAgent: meta.userAgent,
          ipCountry: meta.ipCountry,
        }),
      );
    }
  } catch {
    /* logging is best-effort */
  }

  return Response.json(
    {
      server: {
        ...server,
        installName,
        qualityScore: quality.score,
        qualityTier: quality.tier,
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
        readme,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
        ...rateLimitHeaders(rateLimit),
      },
    },
  );
}
