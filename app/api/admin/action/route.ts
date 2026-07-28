import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers, users } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthorizedAdminEmail } from '../../../../lib/accessAuth';
import { parsePendingRevision } from '../../../../lib/pendingRevision';
import { sendNotificationEmail } from '../../../../lib/notify';
import { getAppUrl } from '../../../../lib/stripe';

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum([
    'approve',
    'reject',
    'set_premium',
    'unset_premium',
    'approve_edit',
    'reject_edit',
    'approve_claim',
    'reject_claim',
  ]),
});

export async function POST(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const result = actionSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }
    
    const { id, action } = result.data;
    
    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error("Could not get Cloudflare context.");
    }

    if (!env || !env.DB) {
      throw new Error("Database binding not found");
    }
    
    const db = drizzle(env.DB as any);
    
    if (action === 'approve') {
      const updateResult = await db.update(servers)
        .set({ status: 'active' })
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();
        
      if (updateResult.length === 0) {
         return NextResponse.json({ error: "Server not found or not in pending state." }, { status: 400 });
      }
    } else if (action === 'reject') {
      const deleteResult = await db.delete(servers)
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();
        
      if (deleteResult.length === 0) {
         return NextResponse.json({ error: "Server not found or not in pending state." }, { status: 400 });
      }
    } else if (action === 'set_premium' || action === 'unset_premium') {
      const updateResult = await db.update(servers)
        .set({ isPremium: action === 'set_premium' })
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }
    } else if (action === 'approve_edit' || action === 'reject_edit') {
      const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      const server = rows[0];
      if (!server || !server.pendingRevision) {
        return NextResponse.json({ error: 'No pending edit for this listing.' }, { status: 400 });
      }

      const pending = parsePendingRevision(server.pendingRevision);
      if (!pending) {
        // Corrupt blob — clear it rather than getting permanently stuck.
        await db.update(servers).set({ pendingRevision: null }).where(eq(servers.id, id));
        return NextResponse.json({ error: 'Stored edit was corrupt and has been cleared.' }, { status: 400 });
      }

      if (action === 'approve_edit') {
        const fieldUpdates: Record<string, unknown> = { ...pending.proposed, pendingRevision: null };
        if ('websiteUrl' in pending.proposed) {
          fieldUpdates.websiteVerified = false;
        }
        await db.update(servers).set(fieldUpdates).where(eq(servers.id, id));
      } else {
        await db.update(servers).set({ pendingRevision: null }).where(eq(servers.id, id));
      }

      if (server.ownerUserId) {
        const ownerRows = await db.select().from(users).where(eq(users.id, server.ownerUserId)).limit(1);
        const ownerEmail = ownerRows[0]?.email;
        if (ownerEmail) {
          await sendNotificationEmail({
            to: ownerEmail,
            heading: action === 'approve_edit' ? 'Your edit was approved' : 'Your edit needs changes',
            message:
              action === 'approve_edit'
                ? `Your changes to ${server.name} are now live.`
                : `Your proposed changes to ${server.name} were not approved. You can submit a new edit from your dashboard.`,
            actionText: 'View listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }
    } else if (action === 'approve_claim' || action === 'reject_claim') {
      const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      const server = rows[0];
      if (!server || !server.pendingClaimUserId) {
        return NextResponse.json({ error: 'No pending claim for this listing.' }, { status: 400 });
      }

      if (action === 'approve_claim') {
        await db
          .update(servers)
          .set({
            isOfficial: true,
            claimedAt: server.claimedAt || new Date(),
            ownerUserId: server.pendingClaimUserId,
            websiteUrl: server.pendingClaimWebsiteUrl,
            websiteVerified: true,
            pendingClaimUserId: null,
            pendingClaimWebsiteUrl: null,
          })
          .where(eq(servers.id, id));
      } else {
        await db
          .update(servers)
          .set({ pendingClaimUserId: null, pendingClaimWebsiteUrl: null })
          .where(eq(servers.id, id));
      }

      const claimantRows = await db.select().from(users).where(eq(users.id, server.pendingClaimUserId)).limit(1);
      const claimantEmail = claimantRows[0]?.email;
      if (claimantEmail) {
        await sendNotificationEmail({
          to: claimantEmail,
          heading: action === 'approve_claim' ? 'Your claim was approved' : 'Your claim needs review',
          message:
            action === 'approve_claim'
              ? `Your claim on ${server.name} is now approved — the listing is yours.`
              : `Your claim on ${server.name} wasn't approved. Contact us if you believe this is a mistake.`,
          actionText: 'View listing',
          actionUrl: `${getAppUrl()}/mcp/${id}`,
        });
      }
    }

    const messages: Record<string, string> = {
      approve: 'Listing approved.',
      reject: 'Listing rejected.',
      set_premium: 'Marked premium.',
      unset_premium: 'Premium removed.',
      approve_edit: 'Edit approved and applied.',
      reject_edit: 'Edit rejected.',
      approve_claim: 'Claim approved.',
      reject_claim: 'Claim rejected.',
    };
    return NextResponse.json({ success: true, message: messages[action] });
  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
