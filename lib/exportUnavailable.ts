/**
 * The answer a whole-catalog export (llms.txt, llms-full.txt, data.json)
 * gives when D1 fails: a 503 nothing caches, never the 114-row bundled
 * snapshot dressed up as the catalog. The snapshot fallback used to be served
 * with a 24h s-maxage, so one D1 blip published "114 servers" for a day.
 */
const RETRY_AFTER_SECONDS = 120;

const MESSAGE =
  'The AllMCPs catalog database did not answer, so this export was not generated. Retry in a few minutes. This response is an error, not a partial catalog.';

export function exportUnavailable(
  format: 'text' | 'json',
  err?: unknown,
): Response {
  if (err) console.error('[export] catalog export failed:', err);
  const headers = {
    'Cache-Control': 'no-store',
    'Retry-After': String(RETRY_AFTER_SECONDS),
  };
  if (format === 'json') {
    return Response.json(
      { error: 'catalog_unavailable', message: MESSAGE },
      {
        status: 503,
        headers: { ...headers, 'Access-Control-Allow-Origin': '*' },
      },
    );
  }
  return new Response(`# Export temporarily unavailable\n\n${MESSAGE}\n`, {
    status: 503,
    headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
