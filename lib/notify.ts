import { Resend } from 'resend';
import { ListingStatusEmail } from '@/components/emails/ListingStatusEmail';
import { NotificationEmail } from '@/components/emails/NotificationEmail';
import { ReceiptEmail } from '@/components/emails/ReceiptEmail';
import { isEmailVerified } from './emailVerification';

export async function getEmailEnv() {
  let apiKey = process.env.RESEND_API_KEY;
  let fromEmail = process.env.RESEND_FROM_EMAIL;
  let adminEmail = process.env.ADMIN_EMAIL;

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env) {
      const env = ctx.env as any;
      if (env.RESEND_API_KEY) apiKey = env.RESEND_API_KEY;
      if (env.RESEND_FROM_EMAIL) fromEmail = env.RESEND_FROM_EMAIL;
      if (env.ADMIN_EMAIL) adminEmail = env.ADMIN_EMAIL;
    }
  } catch {
    // Cloudflare context unavailable in local static generation
  }

  return {
    apiKey,
    fromEmail: `AllMCPs <${fromEmail || 'onboarding@resend.dev'}>`,
    adminEmail: adminEmail || 'cadenjsumner@gmail.com',
  };
}

/**
 * Why an address may get an email:
 * - 'verified' (default): it finished a magic-link sign-in or another proof
 *   (lib/emailVerification.ts), or it is ADMIN_EMAIL.
 * - 'verification': the email is itself the proof step (a code or a
 *   confirmation link), so the address can't have been proven yet.
 * - 'paid': the recipient completed a payment for what the email is about
 *   (a receipt, or a notice about a paid ad campaign).
 */
export type SendBasis = 'verified' | 'verification' | 'paid';

/**
 * The gate every notice to a user-supplied address passes. A bot can type
 * any address into a public form; mailing it bounces, and Resend pauses all
 * sending (magic links included) once bounces pass 4%. A skipped send keeps
 * the caller's record (listing, ad, claim) intact; only the email is dropped.
 * Fails closed: no database, no email.
 */
export async function mayEmail(
  to: string,
  basis: SendBasis = 'verified',
): Promise<boolean> {
  if (basis !== 'verified') return true;
  const address = to.trim().toLowerCase();
  if (!address) return false;
  const { adminEmail } = await getEmailEnv();
  if (adminEmail && adminEmail.trim().toLowerCase() === address) return true;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { drizzle } = await import('drizzle-orm/d1');
    const ctx = await getCloudflareContext();
    const DB = (ctx?.env as { DB?: unknown } | undefined)?.DB;
    if (!DB) return false;
    return await isEmailVerified(drizzle(DB as never), address);
  } catch (e) {
    console.error('[email] verification lookup failed:', e);
    return false;
  }
}

/** Logs a skipped send without the address. */
function logSkipped(subject: string) {
  console.info(`[email] not sent, address not verified: ${subject}`);
}

/**
 * Sends a generic notification email via Resend. No-ops (rather than throwing)
 * when RESEND_API_KEY isn't configured, so a missing secret in a given
 * environment degrades to "no email sent" instead of failing the caller's request.
 */
export async function sendNotificationEmail(params: {
  to: string;
  heading: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  basis?: SendBasis;
}): Promise<boolean> {
  const env = await getEmailEnv();
  if (!env.apiKey) {
    console.warn('sendNotificationEmail skipped: RESEND_API_KEY is missing.');
    return false;
  }
  if (!(await mayEmail(params.to, params.basis))) {
    logSkipped(params.heading);
    return false;
  }

  const resend = new Resend(env.apiKey);

  const { error } = await resend.emails.send({
    from: env.fromEmail,
    to: params.to,
    subject: params.heading,
    react: NotificationEmail({
      heading: params.heading,
      message: params.message,
      actionText: params.actionText,
      actionUrl: params.actionUrl,
    }) as React.ReactElement,
  });

  if (error) {
    console.error('sendNotificationEmail error:', error);
    return false;
  }
  return true;
}

/**
 * Branded payment receipt via Resend — supplements (doesn't replace) Stripe's
 * own default receipt email, since disabling that is an account-level Stripe
 * setting this app doesn't own. No-ops the same way as the other senders when
 * RESEND_API_KEY is missing. Only called once a payment has settled, so it
 * needs no verified address ('paid' in mayEmail's terms).
 */
export async function sendReceiptEmail(params: {
  to: string;
  receiptId: string;
  date: string;
  amount: string;
  description: string;
  actionText?: string;
  actionUrl?: string;
}): Promise<void> {
  const env = await getEmailEnv();
  if (!env.apiKey) {
    console.warn('sendReceiptEmail skipped: RESEND_API_KEY is missing.');
    return;
  }

  const resend = new Resend(env.apiKey);

  const { error } = await resend.emails.send({
    from: env.fromEmail,
    to: params.to,
    subject: `Receipt: ${params.description}`,
    react: ReceiptEmail({
      receiptId: params.receiptId,
      date: params.date,
      amount: params.amount,
      description: params.description,
      actionText: params.actionText,
      actionUrl: params.actionUrl,
    }) as React.ReactElement,
  });

  if (error) {
    console.error('sendReceiptEmail error:', error);
  }
}

/**
 * Listing approved/rejected notice via Resend (fallback when Sequenzy transactional
 * isn't available). Approval copy drives claim + free dofollow backlink for DR growth.
 */
export async function sendListingStatusEmail(params: {
  to: string;
  mcpName: string;
  status: 'approved' | 'rejected';
  listingUrl: string;
  claimUrl?: string;
  feedback?: string;
  /** Rejected only: false hides the edit-and-resubmit invite (see ListingStatusEmail). */
  canResubmit?: boolean;
}): Promise<void> {
  const env = await getEmailEnv();
  if (!env.apiKey) {
    console.warn('sendListingStatusEmail skipped: RESEND_API_KEY is missing.');
    return;
  }
  if (!(await mayEmail(params.to))) {
    logSkipped(`listing ${params.status}`);
    return;
  }

  const resend = new Resend(env.apiKey);
  const subject =
    params.status === 'approved'
      ? `Your MCP is live: ${params.mcpName}`
      : params.canResubmit === false
        ? `About your submission: ${params.mcpName}`
        : `Update needed: ${params.mcpName}`;

  const { error } = await resend.emails.send({
    from: env.fromEmail,
    to: params.to,
    subject,
    react: ListingStatusEmail({
      mcpName: params.mcpName,
      status: params.status,
      listingUrl: params.listingUrl,
      claimUrl: params.claimUrl || `${params.listingUrl}/claim`,
      feedback: params.feedback,
      canResubmit: params.canResubmit,
    }) as React.ReactElement,
  });

  if (error) {
    console.error('sendListingStatusEmail error:', error);
  }
}
