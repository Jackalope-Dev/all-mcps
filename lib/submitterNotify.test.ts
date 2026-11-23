import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readEmailConfirmation } from './emailVerification';
import { emailTestDb } from './testing/emailDb';

const sendNotificationEmail = vi.fn(
  async (_p: { to: string; actionUrl?: string; basis?: string }) => true,
);
const syncSequenzySubscriber = vi.fn(
  async (_p: { email: string; tags: string[] }) => {},
);
vi.mock('./notify', () => ({ sendNotificationEmail }));
vi.mock('./sequenzy', () => ({
  NEWSLETTER_SUBSCRIBERS_LIST_ID: 'news',
  PRODUCT_SUBSCRIBERS_LIST_ID: 'product',
  syncSequenzySubscriber,
}));

const { notifySubmitter } = await import('./submitterNotify');

const env = { AUTH_SECRET: 'auth-secret' };
let testDb = emailTestDb();

beforeEach(() => {
  testDb = emailTestDb();
  sendNotificationEmail.mockClear();
  syncSequenzySubscriber.mockClear();
});

describe('notifySubmitter', () => {
  it('sends an unproven address one confirmation link and nothing else', async () => {
    const outcome = await notifySubmitter(
      testDb.db,
      {
        email: 'typed-in@gmail.com',
        serverId: 'brain',
        name: 'Brain',
        newsletter: true,
        agent: false,
      },
      env,
    );
    expect(outcome).toBe('confirm');
    expect(syncSequenzySubscriber).not.toHaveBeenCalled();
    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
    const mail = sendNotificationEmail.mock.calls[0][0];
    expect(mail).toMatchObject({
      to: 'typed-in@gmail.com',
      basis: 'verification',
    });
    const token = new URL(mail.actionUrl as string).searchParams.get('t');
    expect(await readEmailConfirmation(token, 'auth-secret')).toEqual({
      email: 'typed-in@gmail.com',
      serverId: 'brain',
      newsletter: true,
    });
  });

  it('gives a signed-in submitter the receipt and the Sequenzy sync at once', async () => {
    testDb.sqlite
      .prepare('INSERT INTO users (id, email, email_verified) VALUES (?, ?, ?)')
      .run('u1', 'dev@brainscanner.dev', Date.now());
    const outcome = await notifySubmitter(
      testDb.db,
      {
        email: 'dev@brainscanner.dev',
        serverId: 'brain',
        name: 'Brain',
        newsletter: false,
        agent: true,
      },
      env,
    );
    expect(outcome).toBe('receipt');
    expect(syncSequenzySubscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'dev@brainscanner.dev',
        tags: ['submitted-listing', 'agent-submission'],
      }),
    );
    expect(sendNotificationEmail.mock.calls[0][0].basis).toBeUndefined();
  });

  it('sends nothing when the link cannot be signed', async () => {
    vi.stubEnv('AUTH_SECRET', '');
    const outcome = await notifySubmitter(
      testDb.db,
      {
        email: 'typed-in@gmail.com',
        serverId: 'brain',
        name: 'Brain',
        newsletter: false,
        agent: false,
      },
      {},
    );
    expect(outcome).toBe('confirm');
    expect(sendNotificationEmail).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
