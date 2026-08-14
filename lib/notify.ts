import { Resend } from 'resend';
import { NotificationEmail } from '@/components/emails/NotificationEmail';
import { ListingStatusEmail } from '@/components/emails/ListingStatusEmail';
import { ReceiptEmail } from '@/components/emails/ReceiptEmail';

export async function getEmailEnv() {
  let apiKey = process.env.RESEND_API_KEY;
  let fromEmail = process.env.RESEND_FROM_EMAIL;
  let adminEmail = process.env.ADMIN_EMAIL;

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env) {
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
}): Promise<void> {
  const env = await getEmailEnv();
  if (!env.apiKey) {
    console.warn('sendNotificationEmail skipped: RESEND_API_KEY is missing.');
    return;
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
  }
}

/**
 * Branded payment receipt via Resend — supplements (doesn't replace) Stripe's
 * own default receipt email, since disabling that is an account-level Stripe
 * setting this app doesn't own. No-ops the same way as the other senders when
 * RESEND_API_KEY is missing.
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
}): Promise<void> {
  const env = await getEmailEnv();
  if (!env.apiKey) {
    console.warn('sendListingStatusEmail skipped: RESEND_API_KEY is missing.');
    return;
  }

  const resend = new Resend(env.apiKey);
  const subject =
    params.status === 'approved'
      ? `Your MCP is live: ${params.mcpName}`
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
    }) as React.ReactElement,
  });

  if (error) {
    console.error('sendListingStatusEmail error:', error);
  }
}
