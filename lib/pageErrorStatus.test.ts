import { describe, expect, it, vi } from 'vitest';
import { softenPageError } from './pageErrorStatus';

const page = (status: number, type = 'text/html; charset=utf-8') =>
  new Response('<html>error</html>', {
    status,
    headers: { 'content-type': type, 'cache-control': 's-maxage=3600' },
  });
const get = new Request('https://allmcps.com/mcp/x');

describe('softenPageError', () => {
  it('turns a failed page render into an uncacheable 503 with Retry-After', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = softenPageError(get, page(500));
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(await res.text()).toBe('<html>error</html>');
  });

  it('leaves everything else alone', () => {
    for (const res of [page(200), page(404), page(500, 'application/json')]) {
      expect(softenPageError(get, res)).toBe(res);
    }
    const post = new Request('https://allmcps.com/mcp/x', { method: 'POST' });
    const failed = page(500);
    expect(softenPageError(post, failed)).toBe(failed);
  });
});
