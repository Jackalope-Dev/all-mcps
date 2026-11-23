import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { getEmailEnv } from '@/lib/notify';
import { addressesToBlock, verifyResendSignature } from '@/lib/resendWebhook';
import { blockUndeliverableAddresses } from '@/lib/submitterBlocks';

export const dynamic = 'force-dynamic';

/**
 * Resend's bounce and complaint feedback. Subscribe the endpoint to
 * email.bounced, email.complained and email.suppressed; a hard bounce or a
 * complaint puts the address on the submitter block list (address only), so
 * no form, sign-in or notice mails it again. Answers 2xx for every verified
 * delivery, handled or not, so Resend doesn't retry it.
 */
export async function POST(req: Request) {
  const { env } = await getCloudflareContext();
  const secret =
    (env as { RESEND_WEBHOOK_SECRET?: string }).RESEND_WEBHOOK_SECRET ||
    process.env.RESEND_WEBHOOK_SECRET ||
    '';
  if (!secret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const body = await req.text();
  const ok = await verifyResendSignature({
    secret,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
    body,
  });
  if (!ok) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: Parameters<typeof addressesToBlock>[0];
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const found = addressesToBlock(event);
  if (!found) return NextResponse.json({ received: true, blocked: 0 });

  // Never lock the admin out of sign-in over one bad delivery.
  const { adminEmail } = await getEmailEnv();
  const admin = adminEmail.trim().toLowerCase();
  const emails = found.emails.filter((e) => e !== admin);

  const blocked = await blockUndeliverableAddresses(drizzle(env.DB), {
    emails,
    reason: found.reason,
    sourceId: found.emailId ? `resend:${found.emailId}` : null,
  });
  return NextResponse.json({ received: true, blocked });
}
