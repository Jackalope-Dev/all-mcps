import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_TTL_SECONDS,
  isEmailVerified,
  markEmailVerified,
  readEmailConfirmation,
  signEmailConfirmation,
} from './emailVerification';
import { emailTestDb } from './testing/emailDb';

describe('confirmation tokens', () => {
  const now = Date.UTC(2026, 10, 22);

  it('round-trips the claim, normalizing the address', async () => {
    const t = await signEmailConfirmation(
      { email: ' Dev@BrainScanner.dev ', serverId: 'brain', newsletter: true },
      's3cret',
      now,
    );
    expect(await readEmailConfirmation(t, 's3cret', now)).toEqual({
      email: 'dev@brainscanner.dev',
      serverId: 'brain',
      newsletter: true,
    });
  });

  it('refuses a wrong secret, an edited payload, junk and an expired link', async () => {
    const t = await signEmailConfirmation(
      { email: 'dev@brainscanner.dev', agent: true },
      's3cret',
      now,
    );
    expect(await readEmailConfirmation(t, 'other', now)).toBeNull();
    const [, sig] = t.split('.');
    const forged = btoa(
      JSON.stringify({ e: 'victim@brainscanner.dev', x: 9e9 }),
    ).replace(/=+$/, '');
    expect(
      await readEmailConfirmation(`${forged}.${sig}`, 's3cret', now),
    ).toBeNull();
    expect(await readEmailConfirmation('nope', 's3cret', now)).toBeNull();
    expect(await readEmailConfirmation(null, 's3cret', now)).toBeNull();
    expect(await readEmailConfirmation(t, '', now)).toBeNull();
    const later = now + (CONFIRMATION_TTL_SECONDS + 60) * 1000;
    expect(await readEmailConfirmation(t, 's3cret', later)).toBeNull();
  });
});

describe('verified addresses', () => {
  it('counts only rows with email_verified, and marking is idempotent', async () => {
    const { sqlite, db } = emailTestDb();
    sqlite
      .prepare('INSERT INTO users (id, email) VALUES (?, ?)')
      .run('u1', 'agent@brainscanner.dev');
    expect(await isEmailVerified(db, 'agent@brainscanner.dev')).toBe(false);
    expect(await isEmailVerified(db, 'new@brainscanner.dev')).toBe(false);

    const first = new Date('2026-11-20T00:00:00Z');
    await markEmailVerified(db, 'Agent@BrainScanner.dev', first);
    await markEmailVerified(db, 'new@brainscanner.dev', first);
    await markEmailVerified(db, 'agent@brainscanner.dev', new Date());

    expect(await isEmailVerified(db, 'AGENT@brainscanner.dev')).toBe(true);
    expect(await isEmailVerified(db, 'new@brainscanner.dev')).toBe(true);
    const rows = sqlite
      .prepare('SELECT id, email, email_verified FROM users ORDER BY email')
      .all() as { id: string; email: string; email_verified: number }[];
    expect(rows).toHaveLength(2);
    // The existing row was kept (same id) and its first date never moves.
    expect(rows[0]).toMatchObject({
      id: 'u1',
      email_verified: first.getTime(),
    });
  });
});
