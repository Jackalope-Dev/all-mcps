/**
 * A page render that failed answers 503 with Retry-After, never a cacheable
 * 500.
 *
 * Page renders fail almost only when D1 is overloaded around the cron ticks
 * ("D1 DB is overloaded", "Network connection lost"; Nov 2026), after the one
 * retry in lib/d1Retry.ts. Next answers those with its error page and a 500.
 * A 503 with Retry-After says the same thing to people and says "come back
 * shortly" to crawlers, which treat a run of 500s as a broken URL. no-store
 * keeps the error page out of every cache; ISR itself never stores a failed
 * render, so the next request renders the page afresh.
 */

const RETRY_AFTER_SECONDS = 60;

export function softenPageError(
  request: Request,
  response: Response,
): Response {
  if (response.status !== 500) return response;
  if (request.method !== 'GET' && request.method !== 'HEAD') return response;
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('text/html')) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Retry-After', String(RETRY_AFTER_SECONDS));
  console.warn(
    `[page-error] ${new URL(request.url).pathname} rendered a 500; answered 503`,
  );
  return new Response(response.body, {
    status: 503,
    statusText: 'Service Unavailable',
    headers,
  });
}
