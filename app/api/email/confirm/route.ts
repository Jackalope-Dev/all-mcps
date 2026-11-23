import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '@/db/schema';
import {
  authSecret,
  markEmailVerified,
  readEmailConfirmation,
} from '@/lib/emailVerification';
import { isSubmitterBlocked } from '@/lib/submitterBlocks';
import { syncSubmitter } from '@/lib/submitterNotify';

export const dynamic = 'force-dynamic';

/**
 * The confirmation link sent to a new submitter (lib/submitterNotify.ts).
 * Clicking it proves the address: it is marked verified, so review and
 * approval emails may go to it, and the Sequenzy sync that was held back at
 * submission runs now. Safe to click twice.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const done = (status: 'ok' | 'invalid', listing?: string) => {
    const to = new URL('/email-confirmed', url.origin);
    to.searchParams.set('status', status);
    if (listing) to.searchParams.set('listing', listing);
    return NextResponse.redirect(to, 303);
  };

  const { env } = await getCloudflareContext();
  const claim = await readEmailConfirmation(
    url.searchParams.get('t'),
    authSecret(env),
  );
  if (!claim || !env?.DB) return done('invalid');

  const db = drizzle(env.DB);
  if (await isSubmitterBlocked(db, { email: claim.email })) {
    return done('invalid');
  }
  await markEmailVerified(db, claim.email);

  if (!claim.serverId) return done('ok');
  const [row] = await db
    .select({ name: servers.name, email: servers.submitterEmail })
    .from(servers)
    .where(eq(servers.id, claim.serverId))
    .limit(1);
  // The listing may have been rejected and deleted since; the address is
  // still confirmed.
  if (!row || (row.email ?? '').trim().toLowerCase() !== claim.email) {
    return done('ok');
  }
  await syncSubmitter({
    email: claim.email,
    serverId: claim.serverId,
    name: row.name,
    newsletter: claim.newsletter === true,
    agent: claim.agent === true,
  });
  return done('ok', claim.serverId);
}
