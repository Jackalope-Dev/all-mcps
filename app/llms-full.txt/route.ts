import { extractRequestMeta, logApiAccess } from '@/lib/accessLog';
import { formatCatalogAsOf, getCatalogCount } from '@/lib/catalogCount';
import { exportUnavailable } from '@/lib/exportUnavailable';
import {
  formatServerAsMarkdown,
  iterateActiveServers,
  type Server,
} from '@/lib/servers';

export async function GET(request: Request) {
  // Streamed a page at a time: the full catalog (~30k listings) plus its
  // rendered markdown no longer fits in Worker memory as one string. The
  // first page is read before answering, so a D1 failure is a 503 rather
  // than a 200 with an empty or snapshot body.
  const pages = iterateActiveServers();
  let first: IteratorResult<Server[]>;
  let catalog: Awaited<ReturnType<typeof getCatalogCount>>;
  try {
    [first, catalog] = await Promise.all([pages.next(), getCatalogCount()]);
  } catch (err) {
    return exportUnavailable('text', err);
  }

  let header = `# AllMCPs - Complete Catalog Export (LLM Format)

`;
  header += `> Every Model Context Protocol (MCP) server listed on https://allmcps.com.
`;
  if (catalog) {
    header += `> Listings: ${catalog.count} (as of ${formatCatalogAsOf(catalog)})
`;
  }
  header += `> Promo code AGENTREADY takes 50% off paid boosts, priority review and Premium. Listing is free without it.
`;
  header += `> Generated: ${new Date().toISOString()}

`;

  const encoder = new TextEncoder();
  let pending: IteratorResult<Server[]> | null = first;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(header));
    },
    async pull(controller) {
      try {
        const next = pending ?? (await pages.next());
        pending = null;
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
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
