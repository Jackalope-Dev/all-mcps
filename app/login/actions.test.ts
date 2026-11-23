import { beforeEach, describe, expect, it, vi } from 'vitest';

class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}

const signIn = vi.fn(async () => undefined);
const syncSequenzySubscriber = vi.fn(async (_p: { optInMode?: string }) => {});
const verifyTurnstileToken = vi.fn(
  async (_t: unknown, _e: unknown, _ip: string) =>
    ({ ok: true }) as { ok: boolean },
);
const screenSubmitter = vi.fn(
  async (_db: unknown, _who: { email: string; ipHash?: string | null }) =>
    null as string | null,
);

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'cf-connecting-ip': '203.0.113.7' }),
}));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({ env: { DB: {} } }),
}));
vi.mock('@/lib/auth', () => ({ signIn }));
vi.mock('@/lib/sequenzy', () => ({
  NEWSLETTER_SUBSCRIBERS_LIST_ID: 'news',
  syncSequenzySubscriber,
}));
vi.mock('@/lib/turnstile', () => ({ verifyTurnstileToken }));
vi.mock('@/lib/submitterBlocks', () => ({
  hashSubmitterIp: async (ip: string | null) => (ip ? `hash:${ip}` : null),
  screenSubmitter,
}));

const { requestSignInLink } = await import('./actions');

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function submit(fields: Record<string, string>): Promise<string> {
  try {
    await requestSignInLink(form(fields));
  } catch (e) {
    if (e instanceof Redirect) return e.to;
    throw e;
  }
  throw new Error('expected a redirect');
}

const base = {
  email: 'dev@brainscanner.dev',
  redirectTo: '/mcp/brain/claim',
  'cf-turnstile-response': 'token',
};

beforeEach(() => {
  vi.clearAllMocks();
  verifyTurnstileToken.mockResolvedValue({ ok: true });
  screenSubmitter.mockResolvedValue(null);
});

describe('requestSignInLink', () => {
  it('checks Turnstile and screens with the IP hash before sending the link', async () => {
    expect(await submit(base)).toBe('/verify-request');
    expect(verifyTurnstileToken).toHaveBeenCalledWith(
      'token',
      expect.anything(),
      '203.0.113.7',
    );
    expect(screenSubmitter).toHaveBeenCalledWith(
      expect.anything(),
      { email: 'dev@brainscanner.dev', ipHash: 'hash:203.0.113.7' },
      expect.anything(),
    );
    expect(signIn).toHaveBeenCalledWith('resend', {
      email: 'dev@brainscanner.dev',
      redirect: false,
      redirectTo: '/mcp/brain/claim',
    });
    expect(syncSequenzySubscriber).not.toHaveBeenCalled();
  });

  it('sends no link without a passed Turnstile check, and keeps the destination', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false });
    expect(await submit(base)).toBe(
      '/login?error=check&callbackUrl=%2Fmcp%2Fbrain%2Fclaim',
    );
    expect(screenSubmitter).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('sends no link to a refused or rate-limited address', async () => {
    screenSubmitter.mockResolvedValue('Too many requests');
    expect(await submit({ ...base, redirectTo: '/admin' })).toBe(
      '/login?error=email&callbackUrl=%2Fadmin',
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it('asks Sequenzy for double opt-in when the newsletter box is ticked', async () => {
    await submit({ ...base, newsletterOptIn: 'on' });
    expect(syncSequenzySubscriber).toHaveBeenCalledWith(
      expect.objectContaining({ optInMode: 'double_opt_in' }),
    );
  });
});
