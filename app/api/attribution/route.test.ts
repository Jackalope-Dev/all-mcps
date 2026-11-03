import { describe, expect, it } from 'vitest';
import { readAttributionCookie } from '@/lib/attribution';
import { DELETE, POST } from './route';

const post = (body: unknown, cookie?: string) =>
  POST(
    new Request('https://allmcps.com/api/attribution', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

/** The cookie value the response sets, as a Cookie request header. */
function setCookie(res: Response) {
  const header = res.headers.get('set-cookie');
  return header ? header.split(';')[0] : null;
}

describe('/api/attribution', () => {
  it('sets an HttpOnly first-touch cookie for our own landing page', async () => {
    const res = await post({
      href: 'https://allmcps.com/blog/x?utm_source=reddit',
      referrer: 'https://www.reddit.com/',
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toMatch(
      /HttpOnly; SameSite=Lax; Secure/,
    );
    expect(readAttributionCookie(setCookie(res))).toMatchObject({
      ref: 'reddit.com',
      src: 'reddit',
      land: '/blog/x',
    });
  });

  it('ignores landing pages on other origins', async () => {
    const res = await post({ href: 'https://evil.example/', referrer: '' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('keeps an existing real source but upgrades a direct visit', async () => {
    const first = setCookie(
      await post({ href: 'https://allmcps.com/', referrer: '' }),
    );
    const upgraded = await post(
      { href: 'https://allmcps.com/', referrer: 'https://github.com/' },
      first ?? undefined,
    );
    const second = setCookie(upgraded);
    expect(readAttributionCookie(second)?.ref).toBe('github.com');

    const kept = await post(
      { href: 'https://allmcps.com/', referrer: 'https://x.com/' },
      second ?? undefined,
    );
    expect(kept.headers.get('set-cookie')).toBeNull();
  });

  it('clears the cookie on DELETE', async () => {
    const res = await DELETE(
      new Request('https://allmcps.com/api/attribution', { method: 'DELETE' }),
    );
    expect(res.headers.get('set-cookie')).toMatch(/^allmcps_src=; .*Max-Age=0/);
  });
});
