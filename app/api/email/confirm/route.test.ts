import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isEmailVerified,
  signEmailConfirmation,
} from '@/lib/emailVerification';
import { emailTestDb } from '@/lib/testing/emailDb';

let testDb = emailTestDb();
const syncSubmitter = vi.fn(async (_s: unknown) => {});

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: { DB: testDb.shim, AUTH_SECRET: 'auth-secret' },
  }),
}));
vi.mock('@/lib/submitterNotify', () => ({ syncSubmitter }));

const { GET } = await import('./route');

const click = (token: string) =>
  GET(
    new Request(
      `https://allmcps.com/api/email/confirm?t=${encodeURIComponent(token)}`,
    ),
  );

beforeEach(() => {
  testDb = emailTestDb();
  syncSubmitter.mockClear();
  testDb.sqlite
    .prepare(
      "INSERT INTO servers (id, name, url, description, category, status, submitter_email, created_at) VALUES ('brain', 'Brain', 'https://brainscanner.dev', 'd', 'Other', 'pending', 'dev@brainscanner.dev', 0)",
    )
    .run();
});

describe('GET /api/email/confirm', () => {
  it('verifies the address and runs the held-back Sequenzy sync', async () => {
    const token = await signEmailConfirmation(
      { email: 'dev@brainscanner.dev', serverId: 'brain', newsletter: true },
      'auth-secret',
    );
    const res = await click(token);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(
      'https://allmcps.com/email-confirmed?status=ok&listing=brain',
    );
    expect(await isEmailVerified(testDb.db, 'dev@brainscanner.dev')).toBe(true);
    expect(syncSubmitter).toHaveBeenCalledWith({
      email: 'dev@brainscanner.dev',
      serverId: 'brain',
      name: 'Brain',
      newsletter: true,
      agent: false,
    });

    // A second click is harmless.
    expect((await click(token)).status).toBe(303);
    expect(
      testDb.sqlite.prepare('SELECT count(*) AS n FROM users').get(),
    ).toEqual({ n: 1 });
  });

  it("doesn't sync a listing that belongs to another address", async () => {
    const token = await signEmailConfirmation(
      { email: 'other@brainscanner.dev', serverId: 'brain' },
      'auth-secret',
    );
    const res = await click(token);
    expect(res.headers.get('location')).toContain('status=ok');
    expect(syncSubmitter).not.toHaveBeenCalled();
  });

  it('refuses a forged token and a blocked address', async () => {
    const forged = await signEmailConfirmation(
      { email: 'dev@brainscanner.dev' },
      'wrong-secret',
    );
    expect((await click(forged)).headers.get('location')).toContain(
      'status=invalid',
    );

    testDb.sqlite
      .prepare(
        "INSERT INTO submitter_blocks (kind, value, created_at) VALUES ('email', 'dev@brainscanner.dev', 0)",
      )
      .run();
    const token = await signEmailConfirmation(
      { email: 'dev@brainscanner.dev', serverId: 'brain' },
      'auth-secret',
    );
    expect((await click(token)).headers.get('location')).toContain(
      'status=invalid',
    );
    expect(await isEmailVerified(testDb.db, 'dev@brainscanner.dev')).toBe(
      false,
    );
  });
});
