import { and, count, eq, isNotNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { moderationDecisions, servers } from '../db/schema';
import { notifyListingIndexed } from './indexnow';
import { notifyListingApproved } from './listingApprovalNotify';
import { recordModeration } from './moderationLog';
import { type ModerationReason, rejectionEmail } from './moderationReasons';
import { sendListingStatusEmail } from './notify';
import { REJECTED_STATUS } from './servability';
import { getAppUrl } from './stripe';

/**
 * Approving and rejecting a pending listing, shared by the admin action route
 * and the automation gates (lib/autoDecision.ts) so an automatic decision has
 * exactly the side effects of a click: the same emails, IndexNow ping and
 * status change. Page regeneration stays with the caller (the admin route
 * refreshes every listing action it handles).
 */

type Db = DrizzleD1Database<any>;
type ServerRow = typeof servers.$inferSelect;

const DEFAULT_REJECTION_FEEDBACK =
  'Your listing was not approved. Common reasons: incomplete description, unsafe URL, spam, or a duplicate of an existing listing. You can submit again with clearer details.';

/** Pending → active, then notify. Null when the row is gone or no longer pending. */
export async function approvePendingListing(
  db: Db,
  id: string,
): Promise<ServerRow | null> {
  const [approved] = await db
    .update(servers)
    .set({ status: 'active' })
    .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
    .returning();
  if (!approved) return null;

  // Sequenzy transactional (primary) + Resend fallback. Copy drives the claim
  // and free dofollow badge path — a key DR growth lever.
  await notifyListingApproved({
    id: approved.id,
    name: approved.name,
    submitterEmail: approved.submitterEmail,
    enrollInSequences: true,
  });
  // IndexNow — speed up discovery of the new listing page.
  void notifyListingIndexed(approved, ['/browse', '/sitemap.xml']).catch(
    () => {},
  );
  return approved;
}

/**
 * How many times one submission may be rejected before it is deleted instead
 * of kept for another edit, so a submitter can't loop it forever.
 */
export const MAX_SUBMISSION_REJECTIONS = 3;

/**
 * Rejects a pending listing, records why (moderation_decisions) and emails
 * the submitter.
 *
 * A fixable rejection of a human submission keeps the row as 'rejected',
 * hidden from every public surface, so the submitter can edit it from their
 * dashboard and send it back (app/api/dashboard/resubmit). Anything else is
 * deleted: reasons no edit can fix (adult, spam, duplicate, …), imported
 * listings nobody can edit, and a submission on its last allowed rejection.
 * The email matches: an edit-and-resubmit invite only when the row was kept.
 *
 * Null when the row is gone or no longer pending.
 */
export async function rejectPendingListing(
  db: Db,
  id: string,
  opts: {
    /** Text for the submitter; defaults to the copy for `reasons`. */
    feedback?: string | null;
    reasons?: ModerationReason[];
    note?: string | null;
    source: 'modal' | 'triage' | 'gate';
    decidedBy: string | null;
  },
): Promise<{ row: ServerRow; kept: boolean } | null> {
  const reasons = opts.reasons ?? [];
  const copy = rejectionEmail(reasons);
  const feedback = opts.feedback || copy.feedback || DEFAULT_REJECTION_FEEDBACK;

  let earlier = 0;
  try {
    const [r] = await db
      .select({ n: count() })
      .from(moderationDecisions)
      .where(
        and(
          eq(moderationDecisions.serverId, id),
          eq(moderationDecisions.action, 'reject'),
        ),
      );
    earlier = r?.n ?? 0;
  } catch {
    // Without the history, allow the edit; the resubmit route rechecks.
  }
  const keep = copy.canResubmit && earlier + 1 < MAX_SUBMISSION_REJECTIONS;

  const [kept] = keep
    ? await db
        .update(servers)
        .set({ status: REJECTED_STATUS })
        .where(
          and(
            eq(servers.id, id),
            eq(servers.status, 'pending'),
            isNotNull(servers.submitterEmail),
          ),
        )
        .returning()
    : [];
  const rejected =
    kept ??
    (
      await db
        .delete(servers)
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning()
    )[0];
  if (!rejected) return null;

  await recordModeration(db, {
    row: rejected,
    action: 'reject',
    reasons,
    note: opts.note,
    feedback,
    source: opts.source,
    decidedBy: opts.decidedBy,
  });

  const to =
    typeof rejected.submitterEmail === 'string'
      ? rejected.submitterEmail.trim().toLowerCase()
      : '';
  if (to) {
    try {
      await sendListingStatusEmail({
        to,
        mcpName: rejected.name,
        status: 'rejected',
        listingUrl: `${getAppUrl()}/dashboard`,
        feedback,
        canResubmit: Boolean(kept),
      });
    } catch (e) {
      console.error('Failed to notify submitter on rejection:', e);
    }
  }
  return { row: rejected, kept: Boolean(kept) };
}
