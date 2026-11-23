import type { drizzle } from 'drizzle-orm/d1';
import {
  authSecret,
  isEmailVerified,
  signEmailConfirmation,
} from './emailVerification';
import { sendNotificationEmail } from './notify';
import {
  NEWSLETTER_SUBSCRIBERS_LIST_ID,
  PRODUCT_SUBSCRIBERS_LIST_ID,
  syncSequenzySubscriber,
} from './sequenzy';
import { getAppUrl } from './stripe';

type Db = ReturnType<typeof drizzle>;

type Submission = {
  email: string;
  serverId: string;
  name: string;
  /** The newsletter box on the web form (the agent API has none). */
  newsletter: boolean;
  /** Submitted through the agent API rather than the web form. */
  agent: boolean;
};

/**
 * The Sequenzy sync a submission triggers: the submitted-listing tag starts
 * the claim sequence. Runs only for a proven address, either at submission
 * or when the confirmation link is clicked (app/api/email/confirm).
 */
export function syncSubmitter(s: Submission): Promise<void> {
  const newsletter = s.newsletter && !s.agent;
  return syncSequenzySubscriber({
    email: s.email,
    tags: s.agent
      ? ['submitted-listing', 'agent-submission']
      : newsletter
        ? ['submitted-listing', 'newsletter-signup']
        : ['submitted-listing'],
    lists: newsletter
      ? [PRODUCT_SUBSCRIBERS_LIST_ID, NEWSLETTER_SUBSCRIBERS_LIST_ID]
      : [PRODUCT_SUBSCRIBERS_LIST_ID],
    customAttributes: { serverId: s.serverId, serverName: s.name },
    enrollInSequences: true,
  });
}

/**
 * Emails a new listing's submitter. A proven address gets the usual receipt
 * and the Sequenzy sync. Any other address gets one email only: a link to
 * confirm it, which does both once clicked. Until then nothing else is sent
 * to it, so a bot that types a made-up address costs at most one bounce, and
 * that bounce blocks the address (app/api/resend/webhook).
 *
 * Returns 'confirm' when the submitter has to click the link.
 */
export async function notifySubmitter(
  db: Db,
  s: Submission,
  env?: unknown,
): Promise<'receipt' | 'confirm'> {
  const appUrl = getAppUrl();
  if (await isEmailVerified(db, s.email)) {
    await syncSubmitter(s);
    await sendNotificationEmail({
      to: s.email,
      heading: s.agent
        ? `Agent Submission Received: ${s.name}`
        : `Submission Received: ${s.name}`,
      message: `${s.agent ? 'Your AI agent has submitted' : 'Thank you for submitting'} "${s.name}" to AllMCPs! Your listing is currently queued for review. You can get verified immediately by adding your official AllMCPs badge to your repository or website.`,
      actionText: 'Verify & Claim Listing',
      actionUrl: `${appUrl}/mcp/${s.serverId}/claim`,
    });
    return 'receipt';
  }

  const secret = authSecret(env);
  if (!secret) {
    console.error('[submit] AUTH_SECRET missing: no confirmation link sent');
    return 'confirm';
  }
  const token = await signEmailConfirmation(
    {
      email: s.email,
      serverId: s.serverId,
      newsletter: s.newsletter,
      agent: s.agent,
    },
    secret,
  );
  await sendNotificationEmail({
    to: s.email,
    basis: 'verification',
    heading: `Confirm your email for ${s.name}`,
    message: `"${s.name}" was submitted to AllMCPs with this address and is queued for review. Confirm the address so we can email you when it is approved and send you the link to claim it. If you did not submit it, ignore this email and you will not hear from us again.`,
    actionText: 'Confirm email',
    actionUrl: `${appUrl}/api/email/confirm?t=${encodeURIComponent(token)}`,
  });
  return 'confirm';
}
