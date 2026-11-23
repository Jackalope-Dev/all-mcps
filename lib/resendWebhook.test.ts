import { describe, expect, it } from 'vitest';
import { addressesToBlock, verifyResendSignature } from './resendWebhook';
import { svixSign } from './testing/emailDb';

const SECRET = `whsec_${btoa('a-test-signing-key-32-bytes-long')}`;

describe('verifyResendSignature', () => {
  const body = '{"type":"email.bounced"}';
  const now = 1_790_000_000_000;
  const ts = now / 1000;

  it('accepts a valid signature, including one of several', async () => {
    const sig = await svixSign(SECRET, 'msg_1', ts, body);
    const base = { secret: SECRET, id: 'msg_1', timestamp: String(ts), body };
    expect(
      await verifyResendSignature({ ...base, signature: sig, nowMs: now }),
    ).toBe(true);
    expect(
      await verifyResendSignature({
        ...base,
        signature: `v1,bm90LWl0 ${sig}`,
        nowMs: now,
      }),
    ).toBe(true);
  });

  it('refuses a changed body, another secret, missing headers and a stale delivery', async () => {
    const sig = await svixSign(SECRET, 'msg_1', ts, body);
    const base = {
      secret: SECRET,
      id: 'msg_1',
      timestamp: String(ts),
      signature: sig,
      body,
      nowMs: now,
    };
    expect(await verifyResendSignature({ ...base, body: `${body} ` })).toBe(
      false,
    );
    expect(
      await verifyResendSignature({
        ...base,
        secret: `whsec_${btoa('another-key-another-key-another!')}`,
      }),
    ).toBe(false);
    expect(await verifyResendSignature({ ...base, id: 'msg_2' })).toBe(false);
    expect(await verifyResendSignature({ ...base, signature: null })).toBe(
      false,
    );
    expect(await verifyResendSignature({ ...base, secret: '' })).toBe(false);
    expect(
      await verifyResendSignature({ ...base, nowMs: now + 6 * 60 * 1000 }),
    ).toBe(false);
  });
});

describe('addressesToBlock', () => {
  it('blocks hard bounces, complaints and suppressed sends', () => {
    expect(
      addressesToBlock({
        type: 'email.bounced',
        data: {
          email_id: 'e1',
          to: ['Probe <Probe@Gmail.com>'],
          bounce: { type: 'Permanent', subType: 'General' },
        },
      }),
    ).toEqual({
      emails: ['probe@gmail.com'],
      reason: 'bounced (General)',
      emailId: 'e1',
    });
    expect(
      addressesToBlock({
        type: 'email.complained',
        data: { to: ['a@brainscanner.dev'] },
      }),
    ).toMatchObject({ emails: ['a@brainscanner.dev'] });
    expect(
      addressesToBlock({
        type: 'email.suppressed',
        data: { to: 'a@brainscanner.dev' },
      }),
    ).toMatchObject({ emails: ['a@brainscanner.dev'] });
  });

  it('ignores temporary bounces, other events and events without an address', () => {
    expect(
      addressesToBlock({
        type: 'email.bounced',
        data: { to: ['a@brainscanner.dev'], bounce: { type: 'Temporary' } },
      }),
    ).toBeNull();
    expect(
      addressesToBlock({
        type: 'email.delivered',
        data: { to: ['a@brainscanner.dev'] },
      }),
    ).toBeNull();
    expect(addressesToBlock({ type: 'email.complained', data: {} })).toBeNull();
  });
});
