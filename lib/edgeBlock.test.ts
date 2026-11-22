import { describe, expect, it } from 'vitest';
import {
  badPathResponse,
  blockedResponse,
  hasUndecodablePath,
  isBlockedClient,
  isTorWrite,
  torWriteResponse,
} from './edgeBlock';

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

describe('hasUndecodablePath', () => {
  it('flags invalid percent-escapes that would crash the router', () => {
    for (const p of ['/mcp/%FF', '/mcp/%E0%A4%A', '/mcp/%']) {
      expect(hasUndecodablePath(p), p).toBe(true);
    }
    expect(badPathResponse().status).toBe(400);
  });

  it('leaves normal and validly encoded paths alone', () => {
    for (const p of [
      '/',
      '/mcp/brainscanner',
      '/mcp/caf%C3%A9',
      '/search%20term',
    ]) {
      expect(hasUndecodablePath(p), p).toBe(false);
    }
  });
});

describe('isTorWrite', () => {
  const tor = (method: string) =>
    new Request('https://allmcps.com/api/v1/submit', {
      method,
      headers: { 'cf-ipcountry': 'T1' },
    });

  it('refuses writes from Tor but lets Tor read', () => {
    expect(isTorWrite(tor('POST'))).toBe(true);
    expect(isTorWrite(tor('PUT'))).toBe(true);
    expect(isTorWrite(tor('GET'))).toBe(false);
    expect(isTorWrite(tor('HEAD'))).toBe(false);
    expect(torWriteResponse().status).toBe(403);
  });

  it('never touches non-Tor traffic', () => {
    const us = new Request('https://allmcps.com/api/v1/submit', {
      method: 'POST',
      headers: { 'cf-ipcountry': 'US' },
    });
    expect(isTorWrite(us)).toBe(false);
  });
});
