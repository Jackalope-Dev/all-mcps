import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  discoverRemoteEndpoint,
  endpointCandidates,
  judgeCandidate,
  repoOwnerMatchesSite,
  siteOf,
} from './discoverRemoteEndpoint';

const handshake = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  result: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    serverInfo: { name: 'brain-scanner', version: '1.0.0' },
  },
});
const oauthChallenge =
  'Bearer resource_metadata="https://brainscanner.dev/.well-known/oauth-protected-resource/mcp"';

const urls = (c: { url: string }[]) => c.map((x) => x.url);

describe('siteOf', () => {
  it('reduces a host to its registrable site', () => {
    expect(siteOf('www.brainscanner.dev')).toBe('brainscanner.dev');
    expect(siteOf('api.brainscanner.dev')).toBe('brainscanner.dev');
    expect(siteOf('app.brainscanner.co.uk')).toBe('brainscanner.co.uk');
  });

  it('keeps each shared-hosting tenant separate', () => {
    expect(siteOf('brain.vercel.app')).toBe('brain.vercel.app');
    expect(siteOf('other.vercel.app')).not.toBe(siteOf('brain.vercel.app'));
  });
});

describe('repoOwnerMatchesSite', () => {
  it('accepts a site named for the repo owner', () => {
    expect(
      repoOwnerMatchesSite(
        'https://github.com/brainscanner-io/brain-scanner',
        'https://www.brainscanner.io/',
      ),
    ).toBe(true);
  });

  it("rejects a wrapper that points its website at someone else's product", () => {
    expect(
      repoOwnerMatchesSite(
        'https://github.com/someone/acme-mcp',
        'https://acme.com/',
      ),
    ).toBe(false);
  });
});

describe('endpointCandidates', () => {
  it('guesses the usual paths and subdomains on a hosted product site', () => {
    expect(
      urls(endpointCandidates({ url: 'https://www.brainscanner.dev/' })),
    ).toEqual([
      'https://www.brainscanner.dev/mcp',
      'https://www.brainscanner.dev/api/mcp',
      'https://mcp.brainscanner.dev/mcp',
      'https://mcp.brainscanner.dev/',
      'https://api.brainscanner.dev/mcp',
    ]);
  });

  it('puts URLs the listing states ahead of guesses', () => {
    const c = endpointCandidates({
      url: 'https://brainscanner.dev/agents',
      description: 'Connect at https://connect.brainscanner.dev/mcp.',
      pages: [
        {
          url: 'https://brainscanner.dev/agents',
          html: '<a href="https://app.brainscanner.dev/mcp">endpoint</a>',
        },
      ],
    });
    expect(c.slice(0, 2)).toEqual([
      { url: 'https://connect.brainscanner.dev/mcp', source: 'stated' },
      { url: 'https://app.brainscanner.dev/mcp', source: 'stated' },
    ]);
  });

  it('prefers the endpoint over its linked sub-resources', () => {
    const c = endpointCandidates({
      url: 'https://brainscanner.dev/agents',
      pages: [
        {
          url: 'https://brainscanner.dev/agents',
          html: 'Catalog: https://brainscanner.dev/mcp/catalog — connect to https://brainscanner.dev/mcp',
        },
      ],
    });
    expect(c[0]).toEqual({
      url: 'https://brainscanner.dev/mcp',
      source: 'stated',
    });
  });

  it("ignores another site's endpoint linked from the page", () => {
    const c = endpointCandidates({
      url: 'https://brainscanner.dev/',
      pages: [
        {
          url: 'https://brainscanner.dev/',
          html: 'Works with https://mcp.othervendor.com/mcp and docs at https://brainscanner.dev/docs/mcp',
        },
      ],
    });
    expect(urls(c)).not.toContain('https://mcp.othervendor.com/mcp');
    expect(urls(c)).not.toContain('https://brainscanner.dev/docs/mcp');
  });

  it('never guesses on a directory or code host', () => {
    expect(
      endpointCandidates({ url: 'https://smithery.ai/server/brain-scanner' }),
    ).toEqual([]);
    expect(
      endpointCandidates({ url: 'https://github.com/someone/acme-mcp' }),
    ).toEqual([]);
  });

  it('uses a code-host listing website only when the owner is named for it', () => {
    const own = endpointCandidates({
      url: 'https://github.com/brainscanner-io/brain-scanner',
      websiteUrl: 'https://www.brainscanner.io/',
    });
    expect(urls(own)).toContain('https://api.brainscanner.io/mcp');
    const foreign = endpointCandidates({
      url: 'https://github.com/someone/acme-mcp',
      websiteUrl: 'https://acme.com/',
    });
    expect(foreign).toEqual([]);
  });

  it('only guesses paths on a subdomain or shared host', () => {
    expect(
      urls(endpointCandidates({ url: 'https://prices.brainscanner.dev/' })),
    ).toEqual([
      'https://prices.brainscanner.dev/mcp',
      'https://prices.brainscanner.dev/api/mcp',
    ]);
    expect(
      urls(endpointCandidates({ url: 'https://brain.vercel.app/' })),
    ).toEqual([
      'https://brain.vercel.app/mcp',
      'https://brain.vercel.app/api/mcp',
    ]);
  });
});

describe('judgeCandidate', () => {
  it('reads an open server as no auth', () => {
    expect(
      judgeCandidate(
        { status: 200, contentType: 'application/json', body: handshake },
        'guessed',
      ),
    ).toEqual({ match: true, authType: 'none' });
  });

  it('reads an RFC 9728 challenge as OAuth', () => {
    expect(
      judgeCandidate(
        {
          status: 401,
          contentType: 'application/json',
          wwwAuthenticate: oauthChallenge,
          body: '',
        },
        'guessed',
      ),
    ).toEqual({ match: true, authType: 'oauth' });
  });

  it('accepts a plain Bearer challenge as an API key only when stated', () => {
    const facts = {
      status: 401,
      contentType: 'application/json',
      wwwAuthenticate: 'Bearer realm="Brain Scanner API"',
      body: '{"error":"unauthorized"}',
    };
    expect(judgeCandidate(facts, 'stated')).toEqual({
      match: true,
      authType: 'api_key',
    });
    // A guessed /api/mcp behind a product API's auth wall proves nothing.
    expect(judgeCandidate(facts, 'guessed').match).toBe(false);
  });

  it("won't guess a hosting platform's own server onto a listing", () => {
    const facts = {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2025-06-18',
          serverInfo: { name: 'storefront-renderer', version: '0.1.0' },
        },
      }),
    };
    expect(judgeCandidate(facts, 'guessed').match).toBe(false);
    expect(judgeCandidate(facts, 'stated').match).toBe(true);
  });

  it('rejects a web page', () => {
    expect(
      judgeCandidate(
        { status: 200, contentType: 'text/html', body: '<html></html>' },
        'stated',
      ).match,
    ).toBe(false);
  });
});

describe('discoverRemoteEndpoint', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the best-ranked candidate that answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!init?.method) {
          return new Response('<html>Welcome</html>', {
            headers: { 'content-type': 'text/html' },
          });
        }
        if (url === 'https://api.brainscanner.dev/mcp') {
          return new Response('{}', {
            status: 401,
            headers: {
              'content-type': 'application/json',
              'www-authenticate': oauthChallenge,
            },
          });
        }
        return new Response('<html>Not found</html>', {
          status: 404,
          headers: { 'content-type': 'text/html' },
        });
      }),
    );
    await expect(
      discoverRemoteEndpoint({ url: 'https://brainscanner.dev/' }),
    ).resolves.toEqual({
      url: 'https://api.brainscanner.dev/mcp',
      authType: 'oauth',
      source: 'guessed',
    });
  });

  it('returns null when nothing answers, including on network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')),
    );
    await expect(
      discoverRemoteEndpoint({ url: 'https://brainscanner.dev/' }),
    ).resolves.toBeNull();
  });
});
