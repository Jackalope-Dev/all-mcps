import { NextResponse } from 'next/server';
import { extractRequestMeta, logApiAccess } from '@/lib/accessLog';
import {
  installConfidenceNote,
  resolveInstallConfig,
  toClaudeConfigSnippet,
} from '@/lib/installConfig';
import { listingRedirectTarget } from '@/lib/listingRedirect';
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

  const redirectTarget = listingRedirectTarget(id, server);
  if (redirectTarget) {
    const url = new URL(request.url);
    return NextResponse.redirect(
      new URL(`/api/v1/servers/${redirectTarget}${url.search}`, url.origin),
      308,
    );
  }

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
  // Same resolver the search endpoint and /mcp/[id] use, so a remote server gets its
  // endpoint URL and a stdio server its real package — never a guessed `npx -y <name>`.
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
        installNote: installConfidenceNote(install),
        claudeConfigSnippet: toClaudeConfigSnippet(
          install,
          installName,
          server.aiEnvVars || [],
        ),
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
