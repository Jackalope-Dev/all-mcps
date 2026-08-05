import { getServerById, fetchServerReadme, formatServerAsMarkdown } from '@/lib/servers';
import { logApiAccess, extractRequestMeta } from '@/lib/accessLog';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const readme = await fetchServerReadme(server.url);
  const markdown = formatServerAsMarkdown(server, readme);

  // Log access (best-effort) — this is the URL llms.txt itself advertises for
  // per-listing fetches, so it needs to feed the same "which LLMs access your
  // server" data as the JSON-RPC tool calls do.
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cfCtx = await getCloudflareContext();
    if (cfCtx?.env && (cfCtx.env as any).DB) {
      const logDb = (await import('drizzle-orm/d1')).drizzle((cfCtx.env as any).DB);
      const meta = extractRequestMeta(request);
      cfCtx.ctx.waitUntil(
        logApiAccess(logDb, {
          serverId: server.id,
          endpoint: 'markdown_view',
          userAgent: meta.userAgent,
          ipCountry: meta.ipCountry,
        })
      );
    }
  } catch {
    /* logging is best-effort */
  }

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
