import { Resend } from 'resend';
import { NotificationEmail } from '@/components/emails/NotificationEmail';

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
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const { error } = await resend.emails.send({
    from: fromEmail,
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
