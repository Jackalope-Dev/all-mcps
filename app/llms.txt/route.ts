import { extractRequestMeta, logApiAccess } from '@/lib/accessLog';
import { buildLlmsTxt, renderExport } from '@/lib/catalogExportBuild';
import { serveStoredExport } from '@/lib/catalogExportStore';
import { exportUnavailable } from '@/lib/exportUnavailable';

/**
 * The agent-facing site map. Served from the copy /api/cron/exports stores in
 * R2; built inline (lib/catalogExportBuild.ts) only while no stored copy
 * exists. Paging the catalog per request took ~5 s and 503ed whenever one of
 * its ~16 D1 pages failed.
 */
export async function GET(request: Request) {
  const stored = await serveStoredExport(request, 'llms.txt');
  let response: Response;
  if (stored) {
    response = stored;
  } else {
    try {
      response = new Response(await renderExport(buildLlmsTxt), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=900, s-maxage=900',
        },
      });
    } catch (err) {
      return exportUnavailable('text', err);
    }
  }

  // Log llms.txt access (best-effort)
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
          endpoint: 'llms_txt',
          userAgent: meta.userAgent,
          ipCountry: meta.ipCountry,
        }),
      );
    }
  } catch {
    /* logging is best-effort */
  }

  return response;
}
