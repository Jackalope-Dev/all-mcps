import {
  extractRequestMeta,
  logApiAccess,
  logApiAccessBatch,
} from '@/lib/accessLog';
import { fetchActiveSponsorAd } from '@/lib/ads';
import { resolveCategoryParam } from '@/lib/categories';
import {
  installConfidenceNote,
  resolveInstallConfig,
  toClaudeConfigSnippet,
} from '@/lib/installConfig';
import { computeQualityScore } from '@/lib/qualityScore';
import {
  checkRateLimit,
  clientKey,
  rateLimitedResponse,
  rateLimitHeaders,
} from '@/lib/rateLimit';
import {
  buildAiSearchText,
  hybridRankServers,
  rankServers,
} from '@/lib/search';
import { getActiveServersForScoring, getCategoryServers } from '@/lib/servers';

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(`v1_search:${clientKey(request)}`, 60, 60);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim() || '';
  const rawCategory = searchParams.get('category')?.trim() || '';
  const limitParam = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(1, limitParam), 100);

  // Listings store the full emoji-prefixed category and the catalog query matches
  // that string exactly, so resolve whatever the caller sent (slug, plain label,
  // or full name) onto it first. Passing the raw, lowercased value straight
  // through matched nothing, which is why every category filter came back empty.
  const category = resolveCategoryParam(rawCategory);
  if (rawCategory && !category) {
    return Response.json(
      {
        error: 'unknown_category',
        message: `Unknown category "${rawCategory}". Use a name, label, or slug from /api/v1/categories (e.g. "Databases" or "databases").`,
        status: 400,
        docs: 'https://allmcps.com/api/v1/categories',
      },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
          ...rateLimitHeaders(rateLimit),
        },
      },
    );
  }

  let servers = category
    ? await getCategoryServers(category)
    : await getActiveServersForScoring();

  // Rank by relevance when a query is present (falls back to catalog order otherwise).
  if (query) {
    let vectorMatches: Array<{ id: string; score: number }> = [];
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const cfCtx = await getCloudflareContext();
      if (
        cfCtx?.env &&
        (cfCtx.env as any).VECTOR_INDEX &&
        (cfCtx.env as any).AI
      ) {
        const { queryVectorIndex } = await import('@/lib/vectorSearch');
        vectorMatches = await queryVectorIndex(
          query,
          cfCtx.env as CloudflareEnv,
          40,
        );
      }
    } catch {
      /* Vector search is best-effort fallback */
    }

    const withTools = servers.map((s) => {
      const tools = Array.isArray(s.tools) ? s.tools : [];
      const toolText = tools
        .map((t: { name?: string }) => t?.name || '')
        .filter(Boolean)
        .join(' ');
      const extraText = buildAiSearchText(s);
      return { ...s, toolText, extraText };
    });

    servers =
      vectorMatches.length > 0
        ? hybridRankServers(withTools, query, vectorMatches)
        : rankServers(withTools, query);
  }

  const results = servers.slice(0, limit).map((server) => {
    const install = resolveInstallConfig({
      id: server.id,
      name: server.name,
      url: server.url,
      description: server.description,
      installKind: server.installKind,
      installCommand: server.installCommand,
      installArgs: server.installArgs,
      installPackage: server.installPackage,
      installConfidence: server.installConfidence,
    });
    const installName =
      install.kind === 'stdio' ? install.packageName : server.id;
    const snippetKey = server.id;
    const envVars = server.aiEnvVars || [];

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
      installConfidence: install.confidence,
      // Always accompanies the snippet so a caller that only reads claudeConfigSnippet
      // (skipping installConfidence) still gets the "verify before running" caveat for
      // anything below 'high' confidence.
      installNote: installConfidenceNote(install),
      installKind: install.kind,
      // Required env vars (API keys/tokens) extracted from the README by the AI content
      // pipeline — also embedded as empty placeholders inside claudeConfigSnippet below.
      envVars,
      claudeConfigSnippet: toClaudeConfigSnippet(install, snippetKey, envVars),
      detailUrl: `https://allmcps.com/mcp/${server.id}`,
      markdownUrl: `https://allmcps.com/mcp/${server.id}.md`,
    };
  });

  // Log search API access (best-effort, non-blocking)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cfCtx = await getCloudflareContext();
    if (cfCtx?.env && (cfCtx.env as any).DB) {
      const logDb = (await import('drizzle-orm/d1')).drizzle(
        (cfCtx.env as any).DB,
      );
      const meta = extractRequestMeta(request);
      // Attribute the search to every server it actually surfaced so each
      // owner's "search queries that find you" panel has data to show.
      cfCtx.ctx.waitUntil(
        query && results.length > 0
          ? logApiAccessBatch(logDb, {
              serverIds: results.map((r) => r.id),
              endpoint: 'v1_search',
              methodOrTool: query,
              userAgent: meta.userAgent,
              ipCountry: meta.ipCountry,
            })
          : logApiAccess(logDb, {
              serverId: null,
              endpoint: 'v1_search',
              methodOrTool: query || null,
              userAgent: meta.userAgent,
              ipCountry: meta.ipCountry,
            }),
      );
    }
  } catch {
    /* logging is best-effort */
  }

  const activeAd = await fetchActiveSponsorAd('all');

  return Response.json(
    {
      total: results.length,
      query: query || null,
      category: category || null,
      servers: results,
      sponsor: activeAd
        ? {
            title: activeAd.title,
            description: activeAd.description,
            ctaText: activeAd.ctaText,
            url: activeAd.targetUrl,
          }
        : null,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
        ...rateLimitHeaders(rateLimit),
      },
    },
  );
}
