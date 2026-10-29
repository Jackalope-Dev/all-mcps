import { describe, expect, it } from 'vitest';
import { bufferForCrawler, isVerifiedCrawler } from './crawlerBuffer';

function crawlerRequest(method = 'GET'): Request {
  const req = new Request('https://allmcps.com/mcp/a/vs/b', { method });
  Object.defineProperty(req, 'cf', {
    value: { verifiedBotCategory: 'AI Crawler' },
  });
  return req;
}

function html(body: BodyInit, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    ...init,
    headers: { 'content-type': 'text/html; charset=utf-8', ...init.headers },
  });
}

/** A stream that sends one chunk and then never finishes, like a stalled render. */
function stalledStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('<html>'));
    },
  });
}

describe('isVerifiedCrawler', () => {
  it('is true only when Cloudflare marks the request as a verified bot', () => {
    expect(isVerifiedCrawler(crawlerRequest())).toBe(true);
    expect(isVerifiedCrawler(new Request('https://allmcps.com/'))).toBe(false);
  });
});

describe('bufferForCrawler', () => {
  it('buffers an HTML page and keeps its status and headers', async () => {
    const res = await bufferForCrawler(
      crawlerRequest(),
      html('<html>ok</html>', { status: 404, headers: { 'x-a': '1' } }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('x-a')).toBe('1');
    expect(await res.text()).toBe('<html>ok</html>');
  });

  it('returns a 503 instead of waiting on a render that never finishes', async () => {
    const res = await bufferForCrawler(
      crawlerRequest(),
      html(stalledStream()),
      20,
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('120');
  });

  it('passes non-HTML responses and non-GET requests through untouched', async () => {
    const image = new Response('png', {
      headers: { 'content-type': 'image/png' },
    });
    expect(await bufferForCrawler(crawlerRequest(), image)).toBe(image);
    const head = html('<html>ok</html>');
    expect(await bufferForCrawler(crawlerRequest('HEAD'), head)).toBe(head);
  });
});
