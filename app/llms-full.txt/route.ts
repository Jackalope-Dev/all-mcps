import { extractRequestMeta, logApiAccess } from '@/lib/accessLog';
import { serveStoredExport } from '@/lib/catalogExportStore';
import { exportUnavailable } from '@/lib/exportUnavailable';

/**
 * The full catalog as markdown (~90 MB), served from the copy
 * /api/cron/exports stores in R2 (lib/catalogExportStore.ts), with ETag,
 * conditional requests and byte ranges. Never built per request: that took
 * 30-50 s of D1 reads and rendering per hit and hung isolates on slow
 * readers. With no stored copy yet, it answers 503 until the next build.
 */
export async function GET(request: Request) {
  const stored = await serveStoredExport(request, 'llms-full.txt');

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

  return stored ?? exportUnavailable('text');
}
