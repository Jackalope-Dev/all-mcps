import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { users } from '../db/schema';

type Db = ReturnType<typeof drizzle>;

/**
 * Proof that a person reads an address. An address counts as verified once
 * it has been used to finish a magic-link sign-in (Auth.js sets
 * users.emailVerified), confirmed an agent registration code, or clicked a
 * confirmation link from lib/submitterNotify.ts. Mail that isn't itself one
 * of those proofs only goes to verified addresses (lib/notify.ts), because
 * every bounce from a typed-in address counts against the sender reputation
 * that magic links depend on.
 */

const normalize = (email: string) => email.trim().toLowerCase();

export async function isEmailVerified(db: Db, email: string): Promise<boolean> {
  const address = normalize(email);
  if (!address) return false;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, address), isNotNull(users.emailVerified)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Records that the address was proven. Creates the user row when there is
 * none (the next magic-link sign-in finds and reuses it) and never moves an
 * earlier verification date. Safe to repeat.
 */
export async function markEmailVerified(
  db: Db,
  email: string,
  now = new Date(),
): Promise<void> {
  const address = normalize(email);
  if (!address) return;
  await db
    .insert(users)
    .values({ email: address, emailVerified: now })
    .onConflictDoNothing();
  await db
    .update(users)
    .set({ emailVerified: now })
    .where(and(eq(users.email, address), isNull(users.emailVerified)));
}

/** What a confirmation link carries. */
export type EmailConfirmation = {
  email: string;
  /** The listing the link was sent for, if any. */
  serverId?: string;
  /** The submitter ticked the newsletter box. */
  newsletter?: boolean;
  /** Submitted through the agent API rather than the web form. */
  agent?: boolean;
};

/** How long a confirmation link works. */
export const CONFIRMATION_TTL_SECONDS = 7 * 24 * 60 * 60;

type Payload = { e: string; x: number; s?: string; n?: 1; a?: 1 };

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(`email-confirmation:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, enc.encode(data)),
  );
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * A signed, expiring token for a confirmation link. Stateless: nothing is
 * stored until the link is clicked. `secret` is AUTH_SECRET.
 */
export async function signEmailConfirmation(
  claim: EmailConfirmation,
  secret: string,
  nowMs = Date.now(),
): Promise<string> {
  const payload: Payload = {
    e: normalize(claim.email),
    x: Math.floor(nowMs / 1000) + CONFIRMATION_TTL_SECONDS,
  };
  if (claim.serverId) payload.s = claim.serverId;
  if (claim.newsletter) payload.n = 1;
  if (claim.agent) payload.a = 1;
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await hmac(secret, body))}`;
}

/** The claim in a valid, unexpired token, otherwise null. */
export async function readEmailConfirmation(
  token: string | null | undefined,
  secret: string,
  nowMs = Date.now(),
): Promise<EmailConfirmation | null> {
  if (!token || !secret) return null;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  try {
    if (!sameBytes(fromB64url(sig), await hmac(secret, body))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Payload;
    if (typeof p.e !== 'string' || !p.e.includes('@')) return null;
    if (typeof p.x !== 'number' || p.x * 1000 < nowMs) return null;
    return {
      email: p.e,
      ...(typeof p.s === 'string' ? { serverId: p.s } : {}),
      ...(p.n === 1 ? { newsletter: true } : {}),
      ...(p.a === 1 ? { agent: true } : {}),
    };
  } catch {
    return null;
  }
}

/** AUTH_SECRET from the Worker env, else process.env; '' when unset. */
export function authSecret(env?: unknown): string {
  const fromEnv = (env as { AUTH_SECRET?: string } | null | undefined)
    ?.AUTH_SECRET;
  return fromEnv || process.env.AUTH_SECRET || '';
}
