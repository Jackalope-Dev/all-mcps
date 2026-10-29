/**
 * Buffers page responses for verified crawlers before sending them.
 *
 * Pages stream, so a client that stops reading pauses the render mid-flight and
 * pins its React state, D1 rows and stream buffers in the isolate. Amazon's AI
 * crawler did this for 1-30 minutes per request (Oct 2026); enough of them in
 * one isolate passed the 128 MB limit, and the runtime killed every in-flight
 * request with exceededMemory. Crawlers gain nothing from streaming, so we read
 * the whole body first: a slow reader then holds only the finished HTML, and a
 * render that never finishes becomes a quick 503 instead of a stuck isolate.
 */

const BUFFER_DEADLINE_MS = 20_000;

const BUFFERED_TYPES = ['text/html', 'text/x-component'];

type CrawlerCf = { verifiedBotCategory?: string };

export function isVerifiedCrawler(request: Request): boolean {
  const cf = (request as { cf?: CrawlerCf }).cf;
  return Boolean(cf?.verifiedBotCategory);
}

function shouldBuffer(request: Request, response: Response): boolean {
  if (request.method !== 'GET' || !response.body) return false;
  const type = response.headers.get('content-type') ?? '';
  return BUFFERED_TYPES.some((t) => type.startsWith(t));
}

/** Reads the body fully, or cancels it and returns null once `deadlineMs` passes. */
async function readWithDeadline(
  body: ReadableStream<Uint8Array>,
  deadlineMs: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<'expired'>((resolve) => {
    timer = setTimeout(() => resolve('expired'), deadlineMs);
  });
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), expired]);
      if (next === 'expired') {
        await reader.cancel().catch(() => {});
        return null;
      }
      if (next.done) break;
      chunks.push(next.value);
      size += next.value.byteLength;
    }
  } finally {
    clearTimeout(timer);
  }
  const out = new Uint8Array(new ArrayBuffer(size));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function bufferForCrawler(
  request: Request,
  response: Response,
  deadlineMs = BUFFER_DEADLINE_MS,
): Promise<Response> {
  if (!shouldBuffer(request, response) || !response.body) return response;
  const body = await readWithDeadline(response.body, deadlineMs);
  if (!body) {
    return new Response('Service temporarily unavailable', {
      status: 503,
      headers: { 'retry-after': '120', 'cache-control': 'no-store' },
    });
  }
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
