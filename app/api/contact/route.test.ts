import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncSequenzySubscriber = vi.fn(
  async (_p: { email: string; optInMode?: string }) => {},
);
const screenSubmitter = vi.fn(
  async (_db: unknown, _who: { email: string }) => null as string | null,
);

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({ env: { DB: {}, RESEND_API_KEY: 'k' } }),
}));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: async () => ({ error: null }) };
  },
}));
vi.mock('../../../lib/sequenzy', () => ({
  NEWSLETTER_SUBSCRIBERS_LIST_ID: 'news',
  syncSequenzySubscriber,
}));
vi.mock('../../../lib/submitterBlocks', () => ({
  hashSubmitterIp: async () => 'iphash',
  requestIp: () => '203.0.113.7',
  screenSubmitter,
}));

const { POST } = await import('./route');

const send = (extra: Record<string, unknown>) =>
  POST(
    new Request('https://allmcps.com/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Dev',
        email: 'dev@brainscanner.dev',
        message: 'Hi',
        'cf-turnstile-response': 'token',
        ...extra,
      }),
    }),
  );

beforeEach(() => {
  syncSequenzySubscriber.mockClear();
  screenSubmitter.mockClear();
  screenSubmitter.mockResolvedValue(null);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true })),
  );
});

describe('POST /api/contact newsletter', () => {
  it('is opt-in: no tick, no subscription', async () => {
    for (const extra of [
      {},
      { newsletterOptIn: false },
      { newsletterOptIn: 'on' },
    ]) {
      const res = await send(extra);
      expect(res.status).toBe(200);
    }
    expect(syncSequenzySubscriber).not.toHaveBeenCalled();
  });

  it('screens a ticked address and asks Sequenzy for double opt-in', async () => {
    const res = await send({ newsletterOptIn: true });
    expect(await res.json()).toMatchObject({ newsletter: 'confirm' });
    expect(screenSubmitter).toHaveBeenCalledWith(
      expect.anything(),
      { email: 'dev@brainscanner.dev', ipHash: 'iphash' },
      expect.anything(),
    );
    expect(syncSequenzySubscriber).toHaveBeenCalledWith(
      expect.objectContaining({ optInMode: 'double_opt_in' }),
    );
  });

  it('skips the newsletter for a refused address but still delivers the message', async () => {
    screenSubmitter.mockResolvedValue('blocked');
    const res = await send({ newsletterOptIn: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ newsletter: 'skipped' });
    expect(syncSequenzySubscriber).not.toHaveBeenCalled();
  });
});
