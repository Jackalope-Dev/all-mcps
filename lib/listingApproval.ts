import { and, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { servers } from '../db/schema';
import { notifyListingIndexed } from './indexnow';
import { notifyListingApproved } from './listingApprovalNotify';
import { sendListingStatusEmail } from './notify';
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
  void notifyListingIndexed(approved.id, ['/browse', '/sitemap.xml']).catch(
    () => {},
  );
  return approved;
}

/**
 * Deletes the pending row (so the submitter can resubmit under the same slug)
 * and emails them. Null when the row is gone or no longer pending.
 */
export async function rejectPendingListing(
  db: Db,
  id: string,
  feedback?: string | null,
): Promise<ServerRow | null> {
  const [rejected] = await db
    .delete(servers)
    .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
    .returning();
  if (!rejected) return null;

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
        listingUrl: `${getAppUrl()}/submit`,
        feedback: feedback || DEFAULT_REJECTION_FEEDBACK,
      });
    } catch (e) {
      console.error('Failed to notify submitter on rejection:', e);
    }
  }
  return rejected;
}
