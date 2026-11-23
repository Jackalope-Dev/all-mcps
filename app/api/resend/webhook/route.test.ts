import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isSubmitterBlocked, screenSubmitter } from '@/lib/submitterBlocks';
import { emailTestDb, svixSign } from '@/lib/testing/emailDb';

const SECRET = `whsec_${btoa('a-test-signing-key-32-bytes-long')}`;
let testDb = emailTestDb();

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: {
      DB: testDb.shim,
      RESEND_WEBHOOK_SECRET: SECRET,
      ADMIN_EMAIL: 'owner@allmcps.com',
    },
  }),
}));

const { POST } = await import('./route');

async function deliver(event: unknown, opts: { sign?: boolean } = {}) {
  const body = JSON.stringify(event);
  const id = `msg_${Math.random()}`;
  const ts = Math.floor(Date.now() / 1000);
  const signature =
    opts.sign === false ? 'v1,AAAA' : await svixSign(SECRET, id, ts, body);
  return POST(
    new Request('https://allmcps.com/api/resend/webhook', {
      method: 'POST',
      headers: {
        'svix-id': id,
        'svix-timestamp': String(ts),
        'svix-signature': signature,
      },
      body,
    }),
  );
}

const bounce = (to: string, type = 'Permanent') => ({
  type: 'email.bounced',
  data: { email_id: 'e1', to: [to], bounce: { type, subType: 'General' } },
});

beforeEach(() => {
  testDb = emailTestDb();
});

describe('POST /api/resend/webhook', () => {
  it('blocks a hard-bounced address, once, and every intake then refuses it', async () => {
    const first = await deliver(bounce('probe@gmail.com'));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ received: true, blocked: 1 });

    // Resend retries and repeat bounces change nothing.
    const again = await deliver(bounce('Probe@Gmail.com'));
    expect(await again.json()).toEqual({ received: true, blocked: 0 });

    const rows = testDb.sqlite
      .prepare('SELECT kind, value, reason, created_by FROM submitter_blocks')
      .all();
    expect(rows).toEqual([
      {
        kind: 'email',
        value: 'probe@gmail.com',
        reason: 'bounced (General)',
        created_by: 'resend-webhook',
      },
    ]);
    // The address only: the rest of gmail.com is untouched.
    const db = testDb.db;
    expect(await isSubmitterBlocked(db, { email: 'probe@gmail.com' })).toBe(
      true,
    );
    expect(await isSubmitterBlocked(db, { email: 'real@gmail.com' })).toBe(
      false,
    );
    expect(await screenSubmitter(db, { email: 'probe@gmail.com' })).toMatch(
      /aren't accepted/,
    );
  });

  it('blocks a complaint, but not a temporary bounce or the admin address', async () => {
    await deliver({
      type: 'email.complained',
      data: { to: ['angry@brainscanner.dev'] },
    });
    await deliver(bounce('full@brainscanner.dev', 'Temporary'));
    await deliver(bounce('owner@allmcps.com'));
    const values = testDb.sqlite
      .prepare('SELECT value FROM submitter_blocks')
      .all()
      .map((r) => (r as { value: string }).value);
    expect(values).toEqual(['angry@brainscanner.dev']);
  });

  it('refuses an unsigned or forged delivery without touching the list', async () => {
    const res = await deliver(bounce('victim@gmail.com'), { sign: false });
    expect(res.status).toBe(401);
    expect(
      testDb.sqlite.prepare('SELECT count(*) AS n FROM submitter_blocks').get(),
    ).toEqual({ n: 0 });
  });
});
