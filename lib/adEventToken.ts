/**
 * Signed, short-lived tokens proving an ad impression/click beacon
 * corresponds to an ad the server itself selected and rendered via
 * /api/ads/serve — not a POST forged with a scraped adId (every adId is
 * visible in its own public campaign URL). Minted in ads/serve, verified in
 * ads/event. Without this, a bad actor could rotate IPs to dodge the
 * per-visitor dedup window in ads/event and burn through a competitor's
 * purchased impression credits, forcing their paid campaign to "complete"
 * without ever reaching real users.
 */

const TOKEN_TTL_MS = 30 * 60 * 1000; // generous — an ad can sit rendered on a slow/idle tab for a while before it's scrolled into view

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function getSecret(env?: { AD_EVENT_TOKEN_SECRET?: string }): string | null {
  const secret =
    env?.AD_EVENT_TOKEN_SECRET || process.env.AD_EVENT_TOKEN_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

export async function mintAdEventToken(
  adId: string,
  env?: { AD_EVENT_TOKEN_SECRET?: string },
): Promise<string | null> {
  const secret = getSecret(env);
  if (!secret) {
    console.error(
      '[adEventToken] AD_EVENT_TOKEN_SECRET not configured — serving ad without an event token.',
    );
    return null;
  }
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = await hmac(secret, `${adId}:${exp}`);
  return `${exp}.${sig}`;
}

/**
 * Fails OPEN (returns true) when the secret isn't configured, so a missing
 * optional secret can't silently break ad delivery/tracking — same tradeoff
 * as hashVisitorForServer's null-pepper fallback. Logs loudly either way so
 * a genuinely missing secret doesn't go unnoticed like the Stripe
 * payment_method_types incident.
 */
export async function verifyAdEventToken(
  adId: string,
  token: unknown,
  env?: { AD_EVENT_TOKEN_SECRET?: string },
): Promise<boolean> {
  const secret = getSecret(env);
  if (!secret) {
    console.error(
      '[adEventToken] AD_EVENT_TOKEN_SECRET not configured — skipping event token verification.',
    );
    return true;
  }
  if (!token || typeof token !== 'string') return false;

  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!exp || !sig || Date.now() > exp) return false;

  const expected = await hmac(secret, `${adId}:${exp}`);
  return timingSafeEqual(expected, sig);
}
