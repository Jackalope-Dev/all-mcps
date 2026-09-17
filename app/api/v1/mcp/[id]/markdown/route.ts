import { extractRequestMeta, logApiAccess } from '@/lib/accessLog';
import {
  checkRateLimit,
  clientKey,
  rateLimitedResponse,
  rateLimitHeaders,
} from '@/lib/rateLimit';
import {
  fetchServerReadme,
  formatServerAsMarkdown,
  getServerById,
} from '@/lib/servers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimit = checkRateLimit(`v1_markdown:${clientKey(request)}`, 60, 60);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  let { id } = await params;

  // Strip .md extension if present in id parameter
  if (id.endsWith('.md')) {
    id = id.slice(0, -3);
  }

  const server = await getServerById(id);

  if (!server) {
    return new Response('# 404 - MCP Server Not Found\n', {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  // When we already have our own restructured writeup, formatServerAsMarkdown
  // uses that instead of the raw README — so skip the upstream fetch entirely.
  const readme = server.aiDoc?.trim()
    ? null
    : await fetchServerReadme(server.url);
  const markdown = formatServerAsMarkdown(server, readme);

  // Log access (best-effort) — this is the URL llms.txt itself advertises for
  // per-listing fetches, so it needs to feed the same "which LLMs access your
  // server" data as the JSON-RPC tool calls do.
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
          endpoint: 'markdown_view',
          userAgent: meta.userAgent,
          ipCountry: meta.ipCountry,
        }),
      );
    }
  } catch {
    /* logging is best-effort */
  }

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      // nofollow: this alternate markdown mirrors an upstream README whose
      // relative links would otherwise be crawled and resolved against
      // allmcps.com (/mcp/<id>.md + "docs/x.md" -> /mcp/docs/x.md, a 404).
      'X-Robots-Tag': 'noindex, nofollow',
      ...rateLimitHeaders(rateLimit),
    },
  });
}
