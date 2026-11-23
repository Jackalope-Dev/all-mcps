/**
 * Resend webhooks (delivered through Svix): signature check and the events
 * that should stop us mailing an address again.
 */

/** Svix's replay window: a delivery older or newer than this is refused. */
const TOLERANCE_SECONDS = 5 * 60;

const enc = new TextEncoder();

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True when `svix-signature` holds a valid v1 signature of
 * `${svix-id}.${svix-timestamp}.${body}` under the endpoint's signing secret
 * (`whsec_` + base64 key, from the Resend dashboard), and the timestamp is
 * within five minutes. `body` must be the raw request text.
 */
export async function verifyResendSignature(opts: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowMs?: number;
}): Promise<boolean> {
  const { secret, id, timestamp, signature, body } = opts;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false;

  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = base64ToBytes(secret.replace(/^whsec_/, ''));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = bytesToBase64(
    new Uint8Array(
      await crypto.subtle.sign(
        'HMAC',
        key,
        enc.encode(`${id}.${timestamp}.${body}`),
      ),
    ),
  );
  // The header can carry several space-separated signatures (key rotation).
  return signature.split(' ').some((part) => {
    const [version, sig] = part.split(',');
    return version === 'v1' && !!sig && sameString(sig, expected);
  });
}

type ResendEvent = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { type?: string; subType?: string };
  };
};

/**
 * The addresses to block for an event, and why. A hard (Permanent) bounce,
 * a spam complaint, or a send Resend suppressed because the address bounced
 * or complained before. Temporary bounces (full mailbox, greylisting) are
 * left alone. Null for every other event.
 */
export function addressesToBlock(
  event: ResendEvent,
): { emails: string[]; reason: string; emailId: string | null } | null {
  const data = event.data ?? {};
  let reason: string;
  if (event.type === 'email.bounced') {
    if (data.bounce?.type !== 'Permanent') return null;
    reason = `bounced${data.bounce.subType ? ` (${data.bounce.subType})` : ''}`;
  } else if (event.type === 'email.complained') {
    reason = 'complained (marked as spam)';
  } else if (event.type === 'email.suppressed') {
    reason = 'suppressed by Resend';
  } else {
    return null;
  }
  const to = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
  const emails = [
    ...new Set(
      to
        .map((t) => {
          // "Name <a@b.c>" or a bare address.
          const m = /<([^>]+)>/.exec(t);
          return (m ? m[1] : t).trim().toLowerCase();
        })
        .filter((e) => /^[^\s@]+@[^\s@]+$/.test(e)),
    ),
  ];
  if (emails.length === 0) return null;
  return { emails, reason, emailId: data.email_id ?? null };
}
