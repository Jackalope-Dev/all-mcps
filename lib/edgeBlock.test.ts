import { describe, expect, it } from 'vitest';
import { blockedResponse, isBlockedClient } from './edgeBlock';

const req = (headers: Record<string, string>) =>
  new Request('https://allmcps.com/api/v1/servers/brainscanner', { headers });

describe('isBlockedClient', () => {
  it('blocks the Nov 2026 catalog scraper by IP or user agent', () => {
    expect(isBlockedClient(req({ 'cf-connecting-ip': '192.238.226.25' }))).toBe(
      true,
    );
    expect(
      isBlockedClient(
        req({
          'cf-connecting-ip': '203.0.113.7',
          'user-agent': 'allmcps-catalog-audit/1.0',
        }),
      ),
    ).toBe(true);
  });

  it('lets everyone else through', () => {
    expect(
      isBlockedClient(
        req({
          'cf-connecting-ip': '203.0.113.7',
          'user-agent': 'Mozilla/5.0 (Macintosh)',
        }),
      ),
    ).toBe(false);
    expect(isBlockedClient(req({}))).toBe(false);
  });

  it('answers 403', () => {
    expect(blockedResponse().status).toBe(403);
  });
});
