import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSafeFetchTarget, safeFetch } from './urlSafety';

describe('isSafeFetchTarget', () => {
  it.each([
    'http://localhost/',
    'http://localhost./',
    'http://127.0.0.1/',
    'http://0x7f.1/',
    'http://10.1.2.3/',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.64.0.1/',
    'http://224.0.0.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:a9fe:a9fe]/',
    'http://[fd00::1]/',
    'file:///etc/passwd',
  ])('blocks %s', (url) => {
    expect(isSafeFetchTarget(url)).toBe(false);
  });

  it.each([
    'https://example.com/mcp',
    'http://8.8.8.8/',
    'http://[::ffff:808:808]/',
  ])('allows %s', (url) => {
    expect(isSafeFetchTarget(url)).toBe(true);
  });
});

function redirect(status: number, location: string): Response {
  return new Response(null, { status, headers: { location } });
}

describe('safeFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses a redirect to a private host', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect(302, 'http://169.254.169.254/'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(safeFetch('https://example.com/mcp')).rejects.toThrow(
      /not a permitted endpoint/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows a public redirect, keeping POST on 307', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect(307, '/mcp/'))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await safeFetch('https://example.com/mcp', {
      method: 'POST',
      body: '{}',
    });
    expect(await res.text()).toBe('ok');
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/mcp/');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: '{}',
      redirect: 'manual',
    });
  });

  it('drops Authorization when the redirect changes origin', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect(308, 'https://other.example/mcp'))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await safeFetch('https://example.com/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret', 'X-Api-Key': 'k' },
    });
    const headers = new Headers(fetchMock.mock.calls[1][1].headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-api-key')).toBe('k');
  });

  it('gives up after too many redirects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => redirect(302, 'https://example.com/loop')),
    );
    await expect(safeFetch('https://example.com/loop')).rejects.toThrow(
      /Too many redirects/,
    );
  });
});
