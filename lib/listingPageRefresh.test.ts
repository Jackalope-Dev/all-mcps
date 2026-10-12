import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listingRenderChanged,
  pageServingFetcher,
  refreshListingPages,
  refreshPage,
} from './listingPageRefresh';

const PREVIEW_ID = 'preview-id';

function fakeFetcher(
  respond: (req: { url: string; init?: RequestInit }) => Response,
) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = {
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return respond({ url, init });
    }),
  } as unknown as Fetcher;
  return { fetcher, calls };
}

const revalidated = () =>
  new Response(null, {
    status: 200,
    headers: { 'x-nextjs-cache': 'REVALIDATED' },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('listingRenderChanged', () => {
  it('fires when the website backlink flips either way', () => {
    expect(
      listingRenderChanged(
        { websiteBacklinkOk: false },
        { websiteBacklinkOk: true },
      ),
    ).toBe(true);
    expect(
      listingRenderChanged(
        { websiteBacklinkOk: true },
        { websiteBacklinkOk: false },
      ),
    ).toBe(true);
    expect(
      listingRenderChanged(
        { websiteBacklinkOk: null },
        { websiteBacklinkOk: true },
      ),
    ).toBe(true);
  });

  it('does not fire when nothing visible changed', () => {
    expect(
      listingRenderChanged(
        { websiteBacklinkOk: true },
        { websiteBacklinkOk: true },
      ),
    ).toBe(false);
    expect(
      listingRenderChanged(
        { websiteBacklinkOk: false },
        { websiteBacklinkOk: false },
      ),
    ).toBe(false);
    expect(
      listingRenderChanged(
        { websiteBacklinkOk: null },
        { websiteBacklinkOk: false },
      ),
    ).toBe(false);
    // Update objects that never touched the field.
    expect(listingRenderChanged({ websiteBacklinkOk: true }, {})).toBe(false);
  });

  it('fires when the listing is unpublished', () => {
    expect(
      listingRenderChanged({ websiteBacklinkOk: false }, { status: 'removed' }),
    ).toBe(true);
    expect(
      listingRenderChanged({ websiteBacklinkOk: false }, { status: undefined }),
    ).toBe(false);
  });
});

describe('pageServingFetcher', () => {
  const site = {} as Fetcher;
  const self = {} as Fetcher;

  it('uses the site binding on the jobs Worker, never its own self-reference', () => {
    expect(
      pageServingFetcher({
        WORKER_ROLE: 'jobs',
        SITE: site,
        WORKER_SELF_REFERENCE: self,
      }),
    ).toBe(site);
    expect(
      pageServingFetcher({ WORKER_ROLE: 'jobs', WORKER_SELF_REFERENCE: self }),
    ).toBeNull();
  });

  it('uses the self-reference on the site (or single) Worker', () => {
    expect(
      pageServingFetcher({ WORKER_ROLE: 'site', WORKER_SELF_REFERENCE: self }),
    ).toBe(self);
    expect(pageServingFetcher({ WORKER_SELF_REFERENCE: self })).toBe(self);
    expect(pageServingFetcher({})).toBeNull();
  });
});

describe('refreshPage', () => {
  it('sends the ISR revalidation HEAD and succeeds only on REVALIDATED', async () => {
    const { fetcher, calls } = fakeFetcher(revalidated);
    const ok = await refreshPage(
      '/mcp/foo',
      { WORKER_SELF_REFERENCE: fetcher },
      PREVIEW_ID,
    );
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://allmcps.com/mcp/foo');
    expect(calls[0].init?.method).toBe('HEAD');
    expect(calls[0].init?.headers).toEqual({
      'x-prerender-revalidate': PREVIEW_ID,
      'x-isr': '1',
    });
  });

  it('reports failure when the page was served from cache instead', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetcher } = fakeFetcher(
      () =>
        new Response(null, {
          status: 200,
          headers: { 'x-nextjs-cache': 'HIT' },
        }),
    );
    expect(
      await refreshPage(
        '/mcp/foo',
        { WORKER_SELF_REFERENCE: fetcher },
        PREVIEW_ID,
      ),
    ).toBe(false);
  });

  it('never throws, and skips without a binding or preview id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = {
      fetch: vi.fn(async () => {
        throw new Error('boom');
      }),
    } as unknown as Fetcher;
    expect(
      await refreshPage(
        '/mcp/foo',
        { WORKER_SELF_REFERENCE: throwing },
        PREVIEW_ID,
      ),
    ).toBe(false);

    const { fetcher, calls } = fakeFetcher(revalidated);
    expect(
      await refreshPage('/mcp/foo', { WORKER_SELF_REFERENCE: fetcher }, ''),
    ).toBe(false);
    expect(await refreshPage('/mcp/foo', {}, PREVIEW_ID)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('refreshListingPages', () => {
  it('refreshes each listing once and splits successes from failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('NEXT_PREVIEW_MODE_ID', PREVIEW_ID);
    const { fetcher, calls } = fakeFetcher(({ url }) =>
      url.endsWith('/bad')
        ? new Response(null, { status: 500 })
        : revalidated(),
    );
    const result = await refreshListingPages(['a', 'bad', 'a', 'b c'], {
      WORKER_SELF_REFERENCE: fetcher,
    });
    expect(result).toEqual({ refreshed: ['a', 'b c'], failed: ['bad'] });
    expect(calls.map((c) => c.url)).toEqual([
      'https://allmcps.com/mcp/a',
      'https://allmcps.com/mcp/bad',
      'https://allmcps.com/mcp/b%20c',
    ]);
    vi.unstubAllEnvs();
  });
});
