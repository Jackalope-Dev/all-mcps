import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailTestDb } from './testing/emailDb';

let testDb = emailTestDb();
const sent = vi.fn();

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: {
      DB: testDb.shim,
      RESEND_API_KEY: 're_test',
      ADMIN_EMAIL: 'Owner@AllMCPs.com',
    },
  }),
}));
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (msg: { to: string }) => {
        sent(msg.to);
        return { error: null };
      },
    };
  },
}));

const { mayEmail, sendListingStatusEmail, sendNotificationEmail } =
  await import('./notify');

beforeEach(() => {
  testDb = emailTestDb();
  sent.mockClear();
  testDb.sqlite
    .prepare('INSERT INTO users (id, email, email_verified) VALUES (?, ?, ?)')
    .run('u1', 'owner-of-listing@brainscanner.dev', Date.now());
  testDb.sqlite
    .prepare('INSERT INTO users (id, email) VALUES (?, ?)')
    .run('u2', 'never-signed-in@brainscanner.dev');
});

describe('mayEmail', () => {
  it('allows verified addresses and the admin, and nobody else by default', async () => {
    expect(await mayEmail('owner-of-listing@brainscanner.dev')).toBe(true);
    expect(await mayEmail('owner@allmcps.com')).toBe(true);
    expect(await mayEmail('never-signed-in@brainscanner.dev')).toBe(false);
    expect(await mayEmail('typed-in@gmail.com')).toBe(false);
    expect(await mayEmail('')).toBe(false);
  });

  it('lets a verification email or a paid notice through', async () => {
    expect(await mayEmail('typed-in@gmail.com', 'verification')).toBe(true);
    expect(await mayEmail('typed-in@gmail.com', 'paid')).toBe(true);
  });
});

describe('senders', () => {
  it('skip an unverified recipient and keep going', async () => {
    const msg = { heading: 'Listing approved', message: 'x' };
    expect(
      await sendNotificationEmail({ ...msg, to: 'typed-in@gmail.com' }),
    ).toBe(false);
    await sendListingStatusEmail({
      to: 'typed-in@gmail.com',
      mcpName: 'Brain',
      status: 'rejected',
      listingUrl: 'https://allmcps.com/dashboard',
    });
    expect(sent).not.toHaveBeenCalled();

    expect(
      await sendNotificationEmail({
        ...msg,
        to: 'owner-of-listing@brainscanner.dev',
      }),
    ).toBe(true);
    expect(sent).toHaveBeenCalledWith('owner-of-listing@brainscanner.dev');
  });
});
