import { extractRequestMeta, logApiAccess } from '@/lib/accessLog';
import { formatServerAsMarkdown, iterateActiveServers } from '@/lib/servers';

export async function GET(request: Request) {
  let header = `# AllMCPs - Complete Catalog Export (LLM Format)

`;
  header += `> Full database snapshot of all Model Context Protocol (MCP) servers listed on https://allmcps.com.
`;
  header += `> AI Agent Exclusive Promo: Use promo code AGENTREADY for 50% off all server boosting and premium subscriptions.
`;
  header += `> Generated: ${new Date().toISOString()}

`;

  // Streamed a page at a time: the full catalog (~27k listings) plus its
  // rendered markdown no longer fits in Worker memory as one string.
  const encoder = new TextEncoder();
  const pages = iterateActiveServers();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(header));
    },
    async pull(controller) {
      try {
        const next = await pages.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(
          encoder.encode(
            next.value
              .map(
                (server) => `${formatServerAsMarkdown(server)}
---

`,
              )
              .join(''),
          ),
        );
      } catch (e) {
        controller.error(e);
      }
    },
    async cancel() {
      await pages.return(undefined);
    },
  });

  // Log llms-full.txt access (best-effort)
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
          endpoint: 'llms_full_txt',
          userAgent: meta.userAgent,
          ipCountry: meta.ipCountry,
        }),
      );
    }
  } catch {
    /* logging is best-effort */
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
