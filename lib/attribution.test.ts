import { describe, expect, it } from 'vitest';
import {
  type Attribution,
  attributionFromStripeMetadata,
  attributionToStripeMetadata,
  captureTouch,
  classifyChannel,
  normalizeHeardFrom,
  parseAttribution,
  readAttributionCookie,
  serializeAttribution,
  shouldReplaceTouch,
} from './attribution';

const NOW = 1_790_000_000_000;

const touch = (href: string, referrer = '') =>
  captureTouch({ href, referrer, now: NOW });

const attr = (over: Partial<Attribution> = {}): Attribution => ({
  ref: null,
  src: null,
  med: null,
  cmp: null,
  land: '/',
  ts: NOW,
  ...over,
});

describe('captureTouch', () => {
  it('keeps referrer host, UTM tags and landing path without the query', () => {
    expect(
      touch(
        'https://allmcps.com/mcp/foo?utm_source=Reddit&utm_medium=social&utm_campaign=launch&x=1',
        'https://www.reddit.com/r/mcp/comments/abc',
      ),
    ).toEqual({
      ref: 'reddit.com',
      src: 'Reddit',
      med: 'social',
      cmp: 'launch',
      land: '/mcp/foo',
      ts: NOW,
    });
  });

  it('treats our own site and payment/sign-in bounces as no referrer', () => {
    expect(
      touch('https://allmcps.com/', 'https://allmcps.com/browse')?.ref,
    ).toBe(null);
    expect(
      touch('https://allmcps.com/pricing', 'https://checkout.stripe.com/')?.ref,
    ).toBe(null);
  });

  it('turns ad click ids into a paid source when UTM tags are missing', () => {
    const t = touch('https://allmcps.com/?gclid=abc');
    expect(t?.src).toBe('google');
    expect(classifyChannel(t)).toBe('paid');
  });

  it('skips admin and API pages', () => {
    expect(touch('https://allmcps.com/admin')).toBeNull();
    expect(touch('https://allmcps.com/api/submit')).toBeNull();
  });
});

describe('classifyChannel', () => {
  it.each([
    [attr({ ref: 'google.co.uk' }), 'search'],
    [attr({ ref: 'cn.bing.com' }), 'search'],
    [attr({ ref: 'gemini.google.com' }), 'ai'],
    [attr({ ref: 'mail.google.com' }), 'email'],
    [attr({ src: 'chatgpt.com' }), 'ai'],
    [attr({ ref: 'github.com' }), 'github'],
    [attr({ ref: 'smithery.ai' }), 'directory'],
    [attr({ ref: 'news.ycombinator.com' }), 'social'],
    [attr({ ref: 'secureserver.titan.email' }), 'email'],
    [attr({ src: 'newsletter', med: 'email' }), 'email'],
    [attr({ src: 'x', med: 'cpc' }), 'paid'],
    [attr({ ref: 'someblog.dev' }), 'referral'],
    [attr(), 'direct'],
    [null, 'unknown'],
  ])('%j → %s', (a, channel) => {
    expect(classifyChannel(a)).toBe(channel);
  });
});

describe('shouldReplaceTouch', () => {
  it('keeps the first touch but upgrades a direct visit to a real source', () => {
    expect(shouldReplaceTouch(null, attr())).toBe(true);
    expect(shouldReplaceTouch(attr(), attr({ ref: 'github.com' }))).toBe(true);
    expect(
      shouldReplaceTouch(attr({ ref: 'github.com' }), attr({ ref: 'x.com' })),
    ).toBe(false);
    expect(shouldReplaceTouch(attr({ ref: 'github.com' }), attr())).toBe(false);
  });
});

describe('cookie round trip', () => {
  it('serializes and reads back from a Cookie header', () => {
    const a = attr({ ref: 'reddit.com', src: 'reddit', land: '/blog/x' });
    const header = `foo=1; allmcps_src=${serializeAttribution(a)}; bar=2`;
    expect(readAttributionCookie(header)).toEqual(a);
  });

  it('rejects malformed or tampered values', () => {
    expect(parseAttribution('not-json')).toBeNull();
    expect(parseAttribution(encodeURIComponent('{"v":2,"t":1}'))).toBeNull();
    const tampered = parseAttribution(
      encodeURIComponent(
        JSON.stringify({ v: 1, t: NOW, r: '<script>', s: 'x'.repeat(500) }),
      ),
    );
    expect(tampered?.ref).toBeNull();
    expect(tampered?.src).toHaveLength(100);
  });
});

describe('Stripe metadata', () => {
  it('round trips and drops empty fields', () => {
    const a = attr({ ref: 'github.com', cmp: 'badge' });
    const meta = attributionToStripeMetadata(a);
    expect(meta).toEqual({
      attr_ts: String(NOW),
      attr_ref: 'github.com',
      attr_cmp: 'badge',
      attr_land: '/',
    });
    expect(attributionFromStripeMetadata(meta)).toEqual(a);
    expect(attributionFromStripeMetadata({ serverId: 'x' })).toBeNull();
    expect(attributionToStripeMetadata(null)).toEqual({});
  });
});

describe('normalizeHeardFrom', () => {
  it('accepts only known options', () => {
    expect(normalizeHeardFrom('github')).toBe('github');
    expect(normalizeHeardFrom('spam')).toBeNull();
    expect(normalizeHeardFrom(undefined)).toBeNull();
  });
});
