/**
 * Shared "listing approved" notify path used by admin approve + resend.
 * Drives claim/dofollow growth: transactional email + Sequenzy sequence tag.
 */

import { sendListingStatusEmail } from './notify';
import { getAppUrl } from './stripe';
import { syncSequenzySubscriber, PRODUCT_SUBSCRIBERS_LIST_ID } from './sequenzy';
import { sendSequenzyTransactional, SEQUENZY_TX } from './sequenzyTransactional';

export type ApprovalNotifyInput = {
  id: string;
  name: string;
  submitterEmail?: string | null;
  /** When true, still tag/enroll even if we already emailed (resend). */
  enrollInSequences?: boolean;
};

export type ApprovalNotifyResult = {
  emailed: boolean;
  channel: 'sequenzy' | 'resend' | 'none';
  reason?: string;
};

/**
 * Email submitter + tag for claim/dofollow sequence.
 * Soft-fails (returns result; never throws for delivery issues).
 */
export async function notifyListingApproved(
  server: ApprovalNotifyInput
): Promise<ApprovalNotifyResult> {
  const submitterEmail =
    typeof server.submitterEmail === 'string' ? server.submitterEmail.trim().toLowerCase() : '';

  if (!submitterEmail) {
    return { emailed: false, channel: 'none', reason: 'No submitter email on file.' };
  }

  const appUrl = getAppUrl();
  const listingUrl = `${appUrl}/mcp/${server.id}`;
  const claimUrl = `${listingUrl}/claim`;

  try {
    const sequenzyOk = await sendSequenzyTransactional({
      to: submitterEmail,
      slug: SEQUENZY_TX.LISTING_APPROVED,
      variables: {
        MCP_NAME: server.name,
        LISTING_URL: listingUrl,
        CLAIM_URL: claimUrl,
        mcpName: server.name,
        listingUrl,
        claimUrl,
        serverId: server.id,
      },
    });

    if (!sequenzyOk) {
      await sendListingStatusEmail({
        to: submitterEmail,
        mcpName: server.name,
        status: 'approved',
        listingUrl,
        claimUrl,
      });
    }

    // Tag for claim/dofollow sequence (trigger: listing-approved). one_time
    // enrollment prevents re-runs on true re-sends of the same tag path.
    await syncSequenzySubscriber({
      email: submitterEmail,
      tags: ['listing-approved'],
      lists: [PRODUCT_SUBSCRIBERS_LIST_ID],
      customAttributes: {
        serverId: server.id,
        serverName: server.name,
        listingUrl,
        claimUrl,
        MCP_NAME: server.name,
        LISTING_URL: listingUrl,
        CLAIM_URL: claimUrl,
      },
      enrollInSequences: server.enrollInSequences !== false,
    });

    return { emailed: true, channel: sequenzyOk ? 'sequenzy' : 'resend' };
  } catch (e) {
    console.error('Failed to notify submitter on approval:', e);
    return {
      emailed: false,
      channel: 'none',
      reason: e instanceof Error ? e.message : 'Notify failed',
    };
  }
}
