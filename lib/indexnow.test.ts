import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyListingIndexed } from './indexnow';

const indexable = {
  id: 'awwwards-mcp',
  status: 'active',
  aiDoc: 'Our writeup.',
  toolsSource: 'introspected',
  installNeedsConfig: null,
  remoteEndpointHealthy: null,
  githubStars: 393,
  npmDownloads: 8000,
  staleFlaggedAt: null,
};

describe('notifyListingIndexed', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pings an indexable listing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    await notifyListingIndexed(indexable, ['/browse']);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.urlList).toEqual([
      'https://allmcps.com/mcp/awwwards-mcp',
      'https://allmcps.com/browse',
    ]);
  });

  // Bing flags a pinged URL that the sitemap leaves out as an important page
  // missing from the sitemap, and the sitemap only lists indexable listings.
  it('skips a listing without a writeup yet', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await notifyListingIndexed({ ...indexable, aiDoc: null }, ['/browse']);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
