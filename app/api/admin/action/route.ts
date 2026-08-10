import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers, users, upvoteRecords, viewRecords } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthorizedAdminEmail } from '../../../../lib/accessAuth';
import { isSafeSubmissionUrl } from '../../../../lib/urlSafety';
import { computeFeaturedUntil } from '../../../../lib/featuredGrant';
import { parsePendingRevision, pendingRevisionToDbPatch } from '../../../../lib/pendingRevision';
import { sendNotificationEmail, sendListingStatusEmail } from '../../../../lib/notify';
import { getAppUrl } from '../../../../lib/stripe';
import { notifyListingApproved } from '../../../../lib/listingApprovalNotify';
import { notifyListingIndexed } from '../../../../lib/indexnow';

import { tweetMcpServer } from '../../../../lib/twitter';

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum([
    'approve',
    'reject',
    'set_premium',
    'unset_premium',
    'edit',
    'unpublish',
    'republish',
    'delete',
    'feature',
    'approve_edit',
    'reject_edit',
    'approve_claim',
    'reject_claim',
    'approve_logo',
    'reject_logo',
    'approve_screenshot',
    'reject_screenshot',
    'resend_approval',
    'toggle_official',
    'toggle_website_verified',
    'toggle_reciprocal_badge',
    'check_health',
  ]),
  fields: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().min(1).max(2000).optional(),
      category: z.string().trim().min(1).max(100).optional(),
      url: z.string().trim().min(1).optional(),
      websiteUrl: z.string().trim().optional(),
    })
    .optional(),
  days: z.number().int().min(1).max(365).optional(),
  reason: z.string().trim().max(2000).optional(),
});

const MESSAGES: Record<string, string> = {
  approve: 'Listing approved.',
  reject: 'Listing rejected.',
  set_premium: 'Marked premium (dofollow).',
  unset_premium: 'Premium removed (nofollow).',
  edit: 'Listing updated.',
  unpublish: 'Listing unpublished.',
  republish: 'Listing republished.',
  delete: 'Listing permanently deleted.',
  feature: 'Featured placement granted.',
  approve_edit: 'Edit approved and applied.',
  reject_edit: 'Edit rejected.',
  approve_claim: 'Claim approved.',
  reject_claim: 'Claim rejected.',
  approve_logo: 'Logo approved.',
  reject_logo: 'Logo rejected.',
  approve_screenshot: 'Screenshot approved.',
  reject_screenshot: 'Screenshot rejected.',
  resend_approval: 'Approval email resent.',
  toggle_official: 'Official status updated.',
  toggle_website_verified: 'Website verification status updated.',
  toggle_reciprocal_badge: 'Reciprocal badge status updated.',
  check_health: 'Health check completed.',
};

export async function POST(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const result = actionSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
        .join('; ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { id, action, fields, days, reason } = result.data;

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

      const approvedServer = updateResult[0];

      // Notify submitter: Sequenzy transactional (primary) + Resend fallback.
      // Copy drives claim + free dofollow badge path — key DR growth lever.
      await notifyListingApproved({
        id: approvedServer.id,
        name: approvedServer.name,
        submitterEmail: approvedServer.submitterEmail,
        enrollInSequences: true,
      });

      // IndexNow — speed up discovery of the new listing page.
      void notifyListingIndexed(approvedServer.id, ['/browse', '/sitemap.xml']).catch(() => {});

      // Auto-tweet newly approved MCP server
      try {
        const tweetResult = await tweetMcpServer(db, {
          id: approvedServer.id,
          name: approvedServer.name,
          description: approvedServer.description,
          category: approvedServer.category,
          isNew: true,
        }, {
          source: 'approval',
        });
        // Stamp the rotation clock so the highlight cron doesn't immediately
        // re-post a server we just announced.
        if (tweetResult?.success && tweetResult?.queued) {
          await db.update(servers).set({ lastTweetedAt: new Date() }).where(eq(servers.id, approvedServer.id));
        }
      } catch (e) {
        console.error('Failed to tweet on server approval:', e);
      }
    } else if (action === 'resend_approval') {
      // Re-send the approval email for an already-live listing (missed inbox, etc.).
      const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      const server = rows[0];
      if (!server) {
        return NextResponse.json({ error: 'Server not found.' }, { status: 404 });
      }
      if (server.status !== 'active') {
        return NextResponse.json(
          { error: 'Can only resend approval for active listings.' },
          { status: 400 }
        );
      }

      const result = await notifyListingApproved({
        id: server.id,
        name: server.name,
        submitterEmail: server.submitterEmail,
        // Sequence is one_time — re-tagging is fine; enrollment won't re-fire if already enrolled.
        enrollInSequences: true,
      });

      if (!result.emailed) {
        return NextResponse.json(
          { error: result.reason || 'Could not send approval email.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Approval email resent via ${result.channel}.`,
      });
    } else if (action === 'reject') {
      const deleteResult = await db.delete(servers)
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();

      if (deleteResult.length === 0) {
         return NextResponse.json({ error: "Server not found or not in pending state." }, { status: 400 });
      }

      const rejected = deleteResult[0];
      const submitterEmail =
        typeof rejected.submitterEmail === 'string'
          ? rejected.submitterEmail.trim().toLowerCase()
          : '';
      if (submitterEmail) {
        try {
          await sendListingStatusEmail({
            to: submitterEmail,
            mcpName: rejected.name,
            status: 'rejected',
            listingUrl: `${getAppUrl()}/submit`,
            feedback:
              reason ||
              'Your listing was not approved. Common reasons: incomplete description, unsafe URL, spam, or a duplicate of an existing listing. You can submit again with clearer details.',
          });
        } catch (e) {
          console.error('Failed to notify submitter on rejection:', e);
        }
      }
    } else if (action === 'set_premium' || action === 'unset_premium') {
      const updateResult = await db.update(servers)
        .set({ isPremium: action === 'set_premium' })
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }
    } else if (action === 'edit') {
      if (!fields || Object.keys(fields).length === 0) {
        return NextResponse.json({ error: "No fields provided." }, { status: 400 });
      }

      const updates: Record<string, unknown> = {};
      if (fields.name !== undefined) updates.name = fields.name;
      if (fields.description !== undefined) updates.description = fields.description;
      if (fields.category !== undefined) updates.category = fields.category;
      if (fields.url !== undefined) {
        if (!isSafeSubmissionUrl(fields.url)) {
          return NextResponse.json({ error: "Primary URL must be a public http(s) address." }, { status: 400 });
        }
        updates.url = fields.url;
      }
      if (fields.websiteUrl !== undefined) {
        if (fields.websiteUrl && !isSafeSubmissionUrl(fields.websiteUrl)) {
          return NextResponse.json({ error: "Website URL must be a public http(s) address." }, { status: 400 });
        }
        updates.websiteUrl = fields.websiteUrl || null;
        // Admin retargeted the website — it hasn't been re-proven, so drop verification
        // (matches the behavior of the owner-edit approval path and the claim flow).
        updates.websiteVerified = false;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
      }

      const updateResult = await db.update(servers)
        .set(updates)
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }
    } else if (action === 'unpublish' || action === 'republish') {
      const fromStatus = action === 'unpublish' ? 'active' : 'removed';
      const toStatus = action === 'unpublish' ? 'removed' : 'active';

      const updateResult = await db.update(servers)
        .set({ status: toStatus })
        .where(and(eq(servers.id, id), eq(servers.status, fromStatus)))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json(
          { error: `Server not found or not currently ${fromStatus}.` },
          { status: 400 }
        );
      }

      // Republished listing should re-enter search indexes promptly.
      if (action === 'republish' && updateResult[0]) {
        void notifyListingIndexed(updateResult[0].id).catch(() => {});
      }
    } else if (action === 'delete') {
      const deleteResult = await db.delete(servers)
        .where(eq(servers.id, id))
        .returning();

      if (deleteResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }

      // Clean up dependent per-IP gate rows so a reused id doesn't inherit stale
      // upvote/view history (these have no FK/cascade — servers.id is plain text).
      await db.delete(upvoteRecords).where(eq(upvoteRecords.serverId, id));
      await db.delete(viewRecords).where(eq(viewRecords.serverId, id));

      // Best-effort — an id that never had a logo/screenshot just no-ops here.
      if (env.LOGOS) {
        await env.LOGOS.delete(`live/${id}.png`).catch(() => {});
        await env.LOGOS.delete(`pending/${id}.png`).catch(() => {});
        await env.LOGOS.delete(`screenshots/live/${id}.png`).catch(() => {});
        await env.LOGOS.delete(`screenshots/pending/${id}.png`).catch(() => {});
      }
    } else if (action === 'feature') {
      if (!days) {
        return NextResponse.json({ error: "days is required." }, { status: 400 });
      }

      const rows = await db.select({ featuredUntil: servers.featuredUntil })
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);

      if (rows.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }

      const newFeaturedUntil = computeFeaturedUntil(rows[0].featuredUntil, days);

      await db.update(servers)
        .set({ featuredUntil: newFeaturedUntil })
        .where(eq(servers.id, id));

      return NextResponse.json({
        success: true,
        message: MESSAGES.feature,
        featuredUntil: newFeaturedUntil.toISOString(),
      });
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
        // Arrays must be JSON-stringified for text columns — never spread raw arrays into D1.
        const fieldUpdates: Record<string, unknown> = {
          ...pendingRevisionToDbPatch(pending.proposed),
          pendingRevision: null,
        };
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
                : reason || `Your proposed changes to ${server.name} were not approved. You can submit a new edit from your dashboard.`,
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
              : reason || `Your claim on ${server.name} wasn't approved. Contact us if you believe this is a mistake.`,
          actionText: 'View listing',
          actionUrl: `${getAppUrl()}/mcp/${id}`,
        });
      }
    } else if (action === 'approve_logo' || action === 'reject_logo') {
      const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      const server = rows[0];
      if (!server || !server.pendingLogoKey) {
        return NextResponse.json({ error: 'No pending logo for this listing.' }, { status: 400 });
      }

      if (action === 'approve_logo') {
        const pendingObject = await env.LOGOS.get(server.pendingLogoKey);
        if (!pendingObject) {
          await db.update(servers).set({ pendingLogoKey: null }).where(eq(servers.id, id));
          return NextResponse.json({ error: 'Pending logo was missing in storage; cleared.' }, { status: 400 });
        }
        const liveKey = `live/${id}.png`;
        await env.LOGOS.put(liveKey, await pendingObject.arrayBuffer(), {
          httpMetadata: { contentType: 'image/png' },
        });
        await env.LOGOS.delete(server.pendingLogoKey);
        await db
          .update(servers)
          .set({ logoUrl: `/logos/${id}`, logoSource: 'manual', pendingLogoKey: null })
          .where(eq(servers.id, id));

        // Purge Cloudflare Edge Cache for the logo URL so new image shows instantly
        try {
          const cache = (globalThis as any).caches?.default;
          if (cache) {
            await cache.delete(new Request(`${getAppUrl()}/logos/${id}`));
          }
        } catch {
          /* ignore non-worker context */
        }
      } else {
        await env.LOGOS.delete(server.pendingLogoKey);
        await db.update(servers).set({ pendingLogoKey: null }).where(eq(servers.id, id));
      }

      if (server.ownerUserId) {
        const ownerRows = await db.select().from(users).where(eq(users.id, server.ownerUserId)).limit(1);
        const ownerEmail = ownerRows[0]?.email;
        if (ownerEmail) {
          await sendNotificationEmail({
            to: ownerEmail,
            heading: action === 'approve_logo' ? 'Your logo was approved' : 'Your logo needs changes',
            message:
              action === 'approve_logo'
                ? `Your new logo for ${server.name} is now live.`
                : reason || `Your uploaded logo for ${server.name} was not approved. You can upload a different one from your dashboard.`,
            actionText: 'View listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }
    } else if (action === 'approve_screenshot' || action === 'reject_screenshot') {
      const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      const server = rows[0];
      if (!server || !server.pendingScreenshotKey) {
        return NextResponse.json({ error: 'No pending screenshot for this listing.' }, { status: 400 });
      }

      if (action === 'approve_screenshot') {
        const pendingObject = await env.LOGOS.get(server.pendingScreenshotKey);
        if (!pendingObject) {
          await db.update(servers).set({ pendingScreenshotKey: null }).where(eq(servers.id, id));
          return NextResponse.json(
            { error: 'Pending screenshot was missing in storage; cleared.' },
            { status: 400 }
          );
        }
        const liveKey = `screenshots/live/${id}.png`;
        await env.LOGOS.put(liveKey, await pendingObject.arrayBuffer(), {
          httpMetadata: { contentType: 'image/png' },
        });
        await env.LOGOS.delete(server.pendingScreenshotKey);
        await db
          .update(servers)
          .set({ screenshotUrl: `/screenshots/${id}`, pendingScreenshotKey: null })
          .where(eq(servers.id, id));

        // Purge Cloudflare Edge Cache for the screenshot URL so new image shows instantly
        try {
          const cache = (globalThis as any).caches?.default;
          if (cache) {
            await cache.delete(new Request(`${getAppUrl()}/screenshots/${id}`));
          }
        } catch {
          /* ignore non-worker context */
        }
      } else {
        await env.LOGOS.delete(server.pendingScreenshotKey);
        await db.update(servers).set({ pendingScreenshotKey: null }).where(eq(servers.id, id));
      }

      if (server.ownerUserId) {
        const ownerRows = await db.select().from(users).where(eq(users.id, server.ownerUserId)).limit(1);
        const ownerEmail = ownerRows[0]?.email;
        if (ownerEmail) {
          await sendNotificationEmail({
            to: ownerEmail,
            heading:
              action === 'approve_screenshot'
                ? 'Your screenshot was approved'
                : 'Your screenshot needs changes',
            message:
              action === 'approve_screenshot'
                ? `Your screenshot for ${server.name} is now live.`
                : reason || `Your uploaded screenshot for ${server.name} was not approved. You can upload a different one from your dashboard.`,
            actionText: 'View listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }
    } else if (action === 'toggle_official') {
      const rows = await db.select({ isOfficial: servers.isOfficial }).from(servers).where(eq(servers.id, id)).limit(1);
      if (rows.length === 0) return NextResponse.json({ error: 'Server not found.' }, { status: 404 });
      const nextOfficial = !rows[0].isOfficial;
      await db.update(servers).set({ isOfficial: nextOfficial, claimedAt: nextOfficial ? new Date() : null }).where(eq(servers.id, id));
      return NextResponse.json({ success: true, message: `Official badge ${nextOfficial ? 'granted' : 'removed'}.`, isOfficial: nextOfficial });
    } else if (action === 'toggle_website_verified') {
      const rows = await db.select({ websiteVerified: servers.websiteVerified, reciprocalBadgeOk: servers.reciprocalBadgeOk }).from(servers).where(eq(servers.id, id)).limit(1);
      if (rows.length === 0) return NextResponse.json({ error: 'Server not found.' }, { status: 404 });
      const nextVerified = !rows[0].websiteVerified;
      await db.update(servers).set({ websiteVerified: nextVerified, reciprocalBadgeOk: nextVerified }).where(eq(servers.id, id));
      return NextResponse.json({
        success: true,
        message: `Website verification ${nextVerified ? 'verified' : 'unverified'} (badge ${nextVerified ? 'granted' : 'removed'}).`,
        websiteVerified: nextVerified,
        reciprocalBadgeOk: nextVerified,
      });
    } else if (action === 'toggle_reciprocal_badge') {
      const rows = await db.select({ reciprocalBadgeOk: servers.reciprocalBadgeOk }).from(servers).where(eq(servers.id, id)).limit(1);
      if (rows.length === 0) return NextResponse.json({ error: 'Server not found.' }, { status: 404 });
      const nextBadge = !rows[0].reciprocalBadgeOk;
      await db.update(servers).set({ reciprocalBadgeOk: nextBadge }).where(eq(servers.id, id));
      return NextResponse.json({
        success: true,
        message: `Reciprocal badge ${nextBadge ? 'marked active' : 'marked inactive'}.`,
        reciprocalBadgeOk: nextBadge,
      });
    } else if (action === 'check_health') {
      const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      const server = rows[0];
      if (!server) return NextResponse.json({ error: 'Server not found.' }, { status: 404 });

      let healthy = true;
      let repoStatus = 200;
      let websiteStatus: number | null = null;

      try {
        const repoRes = await fetch(server.url, { method: 'HEAD', signal: AbortSignal.timeout(6000) }).catch(() => null);
        repoStatus = repoRes?.status || 0;
        if (!repoRes || repoRes.status >= 400) healthy = false;
      } catch {
        healthy = false;
      }

      if (server.websiteUrl) {
        try {
          const webRes = await fetch(server.websiteUrl, { method: 'HEAD', signal: AbortSignal.timeout(6000) }).catch(() => null);
          websiteStatus = webRes?.status || 0;
          if (!webRes || webRes.status >= 400) healthy = false;
        } catch {
          websiteStatus = 0;
        }
      }

      const nextHealth = healthy ? 'healthy' : 'offline';
      await db.update(servers).set({ healthStatus: nextHealth, lastCheckedAt: new Date() }).where(eq(servers.id, id));

      return NextResponse.json({
        success: true,
        message: `Health check done. Status: ${nextHealth} (Repo HTTP ${repoStatus}${websiteStatus !== null ? `, Site HTTP ${websiteStatus}` : ''})`,
        healthStatus: nextHealth,
      });
    }

    return NextResponse.json({ success: true, message: MESSAGES[action] });
  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
