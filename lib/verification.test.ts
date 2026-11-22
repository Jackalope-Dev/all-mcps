import { afterEach, describe, expect, it, vi } from 'vitest';
import { badgeTargetUrl } from './badgeLink';
import {
  readmeClaimBadgeStatus,
  verifyDnsTxt,
  verifyGithubReadme,
  verifyWebsiteHtml,
} from './verification';

const ID = 'rudderstack-mcp';
const USER = 'user-123';
const BADGE_SRC = `https://allmcps.com/api/badge/${ID}?style=shield`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readmeClaimBadgeStatus', () => {
  it('accepts the personalized badge', () => {
    const md = `[![AllMCPs](${BADGE_SRC})](${badgeTargetUrl('https://allmcps.com', ID, USER)})`;
    expect(readmeClaimBadgeStatus(md, ID, USER)).toBe('ok');
  });

  it('flags the public badge as generic (RudderStack regression)', () => {
    // Their README carried the badge the agent submit tool handed out, which
    // has no verify token, and the claim failed with a generic "not found".
    const md = `[![AllMCPs Verified](${BADGE_SRC})](https://allmcps.com/mcp/${ID})`;
    expect(readmeClaimBadgeStatus(md, ID, USER)).toBe('generic');
  });

  it("flags another account's badge", () => {
    const md = `[![AllMCPs](${BADGE_SRC})](https://allmcps.com/mcp/${ID}?verify=someone-else)`;
    expect(readmeClaimBadgeStatus(md, ID, USER)).toBe('other-account');
  });

  it('reports a missing badge', () => {
    expect(readmeClaimBadgeStatus('# Hello', ID, USER)).toBe('missing');
  });
});

describe('badgeTargetUrl', () => {
  it('links signed-out viewers to the plain listing', () => {
    expect(badgeTargetUrl('https://allmcps.com', ID, null)).toBe(
      `https://allmcps.com/mcp/${ID}`,
    );
  });
});

describe('verifyGithubReadme', () => {
  it('tells the claimant to swap a public badge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            `[![AllMCPs](${BADGE_SRC})](https://allmcps.com/mcp/${ID})`,
          ),
      ),
    );
    const res = await verifyGithubReadme(
      'https://github.com/rudderlabs/rudderstack-mcp',
      ID,
      USER,
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/public AllMCPs badge/);
  });
});

describe('website verification', () => {
  it('rejects a repo URL as the website before fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const repo = 'https://github.com/rudderlabs/rudderstack-mcp';
    for (const res of [
      await verifyWebsiteHtml(repo, ID, USER),
      await verifyDnsTxt(repo, ID, USER),
    ]) {
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/GitHub README method/);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  const TOKEN = `allmcps-site-verification=${ID}:${USER}`;
  const html = (head: string, body = '') =>
    new Response(`<html><head>${head}</head><body>${body}</body></html>`, {
      headers: { 'content-type': 'text/html' },
    });

  it('accepts the personalized meta tag on the homepage, whatever path was typed', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      html(`<meta content="${TOKEN}" name="allmcps-verification" />`),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await verifyWebsiteHtml(
      'https://brainscanner.dev/docs/mcp?utm_source=allmcps',
      ID,
      USER,
    );
    expect(res.ok).toBe(true);
    // Only the origin's homepage is fetched, never the claimant's path/query.
    expect(fetchMock.mock.calls[0][0]).toBe('https://brainscanner.dev/');
  });

  it('rejects the Nov 2026 echo-service trick (token on a page that prints the URL)', async () => {
    // httpbin.org/base64/<token> returns the decoded token as the body; a 404
    // or search page that echoes the URL looks the same.
    const fetchMock = vi.fn(async (_url: string) => html('', TOKEN));
    vi.stubGlobal('fetch', fetchMock);
    const res = await verifyWebsiteHtml(
      `https://httpbin.org/base64/${btoa(TOKEN)}`,
      ID,
      USER,
    );
    expect(res.ok).toBe(false);
    expect(fetchMock.mock.calls[0][0]).toBe('https://httpbin.org/');
  });

  it("rejects another account's token and a token outside a meta tag", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        html(
          `<meta name="allmcps-verification" content="allmcps-site-verification=${ID}:someone-else">`,
          `<p>${TOKEN}</p>`,
        ),
      ),
    );
    expect(
      (await verifyWebsiteHtml('https://brainscanner.dev', ID, USER)).ok,
    ).toBe(false);
  });

  it('refuses a homepage that redirects to a private address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'http://169.254.169.254/' },
          }),
      ),
    );
    const res = await verifyWebsiteHtml('https://brainscanner.dev', ID, USER);
    expect(res.ok).toBe(false);
  });

  it('turns a body read that aborts mid-download into a failure, not a throw', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new DOMException('timed out', 'TimeoutError'));
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    );
    const res = await verifyWebsiteHtml(
      'https://www.rudderstack.com/',
      ID,
      USER,
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/took too long/);
  });
});
