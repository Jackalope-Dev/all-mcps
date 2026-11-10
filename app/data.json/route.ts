import { buildDataJson, renderExport } from '@/lib/catalogExportBuild';
import { serveStoredExport } from '@/lib/catalogExportStore';
import { exportUnavailable } from '@/lib/exportUnavailable';

/**
 * Public, structured export of the whole directory — a single clean pull for
 * agents, crawlers, and answer engines that want the catalog as data rather than
 * scraping HTML. Advertised via Dataset JSON-LD on the homepage and linked from
 * llms.txt so it's discoverable as a citable source.
 *
 * Served from the copy /api/cron/exports stores in R2. Built inline only
 * while no stored copy exists (a fresh bucket); the build is lib/catalogExportBuild.ts.
 */
const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function GET(request: Request) {
  const stored = await serveStoredExport(request, 'data.json', CORS);
  if (stored) return stored;
  let body: string;
  try {
    body = await renderExport(buildDataJson);
  } catch (err) {
    return exportUnavailable('json', err);
  }
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
      ...CORS,
    },
  });
}
