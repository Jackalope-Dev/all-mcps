import { NextResponse } from 'next/server';
import { extractRequestMeta, logApiAccess } from '@/lib/accessLog';
import {
  installConfidenceNote,
  toClaudeConfigSnippet,
} from '@/lib/installConfig';
import {
  listingClientConfigs,
  resolveListingInstall,
} from '@/lib/listingClientConfigs';
import { listingRedirectTarget } from '@/lib/listingRedirect';
import { computeQualityScore } from '@/lib/qualityScore';
import {
  checkRateLimit,
  clientKey,
  rateLimitedResponse,
  rateLimitHeaders,
} from '@/lib/rateLimit';
import { isServable } from '@/lib/servability';
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

  // Pending, rejected and flagged listings exist, but the API does not hand
  // out their install config as though they were recommended.
  if (!isServable(server)) {
    return Response.json(
      {
        error: 'not_available',
        message: `Listing "${id}" is not currently listed in the directory (${server.staleFlaggedAt ? 'flagged for review' : server.status}).`,
      },
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
  // Same resolver the search endpoint and /mcp/[id] use, so a remote server gets its
  // endpoint URL and a stdio server its real package — never a guessed `npx -y <name>`.
  const install = resolveListingInstall(server);
  // Same key rule as /api/v1/search: the real package for stdio, else the id.
  const installName =
    install.kind === 'stdio' ? install.packageName : server.id;
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
        // Per-client configs (Claude Desktop, Claude Code, Cursor, VS Code, …),
        // or null when the install was only guessed — see listingClientConfigs.
        configs: listingClientConfigs(server),
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
