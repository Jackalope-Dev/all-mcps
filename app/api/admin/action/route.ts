import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  reports,
  reviews,
  servers,
  upvoteRecords,
  users,
  viewRecords,
} from '../../../../db/schema';
import { getAuthorizedAdminEmail } from '../../../../lib/adminAuth';
import { generateListingContent } from '../../../../lib/aiContent';
import { DEFAULT_SUBMIT_CATEGORY } from '../../../../lib/categories';
import { cleanListingDescription } from '../../../../lib/description';
import { computeFeaturedUntil } from '../../../../lib/featuredGrant';
import { getGithubToken } from '../../../../lib/githubAuth';
import { notifyListingIndexed } from '../../../../lib/indexnow';
import { notifyListingApproved } from '../../../../lib/listingApprovalNotify';
import {
  fetchGithubReadme,
  parseGithubUrl,
} from '../../../../lib/listingEnrich';
import { resolveCanonicalMergeTarget } from '../../../../lib/listingRedirect';
import {
  sendListingStatusEmail,
  sendNotificationEmail,
} from '../../../../lib/notify';
import {
  parsePendingRevision,
  pendingRevisionToDbPatch,
} from '../../../../lib/pendingRevision';
import { parseServerTools } from '../../../../lib/servers';
import { getAppUrl } from '../../../../lib/stripe';
import { isSafeSubmissionUrl } from '../../../../lib/urlSafety';

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
    'unfeature',
    'enrich_ai',
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
    'toggle_reciprocal_badge',
    'check_health',
    'approve_review_comment',
    'reject_review_comment',
    'delete_review',
    'mark_report_reviewed',
    'dismiss_report',
    'merge_duplicate',
  ]),
  fields: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().min(1).max(2000).optional(),
      category: z.string().trim().min(1).max(100).optional(),
      url: z.string().trim().min(1).optional(),
      websiteUrl: z.string().trim().optional(),
      targetId: z.string().trim().min(1).optional(),
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
  merge_duplicate: 'Listing merged as duplicate and redirected.',
  delete: 'Listing permanently deleted.',
  feature: 'Featured placement granted.',
  unfeature: 'Featured placement removed.',
  enrich_ai: 'AI enrichment generated and applied.',
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
  toggle_reciprocal_badge: 'Verified (reciprocal badge) status updated.',
  check_health: 'Health check completed.',
  approve_review_comment: 'Review comment approved.',
  reject_review_comment: 'Review comment rejected.',
  delete_review: 'Review deleted.',
  mark_report_reviewed: 'Report marked as reviewed.',
  dismiss_report: 'Report dismissed.',
};

export async function POST(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const result = actionSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.issues
        .map(
          (issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`,
        )
        .join('; ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { id, action, fields, days, reason } = result.data;

    let env: CloudflareEnv | undefined;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env?.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);

    if (action === 'approve') {
      const updateResult = await db
        .update(servers)
        .set({ status: 'active' })
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json(
          { error: 'Server not found or not in pending state.' },
          { status: 400 },
        );
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
      void notifyListingIndexed(approvedServer.id, [
        '/browse',
        '/sitemap.xml',
      ]).catch(() => {});
    } else if (action === 'resend_approval') {
      // Re-send the approval email for an already-live listing (missed inbox, etc.).
      const rows = await db
        .select()
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      const server = rows[0];
      if (!server) {
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );
      }
      if (server.status !== 'active') {
        return NextResponse.json(
          { error: 'Can only resend approval for active listings.' },
          { status: 400 },
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
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        message: `Approval email resent via ${result.channel}.`,
      });
    } else if (action === 'reject') {
      const deleteResult = await db
        .delete(servers)
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();

      if (deleteResult.length === 0) {
        return NextResponse.json(
          { error: 'Server not found or not in pending state.' },
          { status: 400 },
        );
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
      const updateResult = await db
        .update(servers)
        .set({ isPremium: action === 'set_premium' })
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );
      }
    } else if (action === 'edit') {
      if (!fields || Object.keys(fields).length === 0) {
        return NextResponse.json(
          { error: 'No fields provided.' },
          { status: 400 },
        );
      }

      const updates: Record<string, unknown> = {};
      if (fields.name !== undefined) updates.name = fields.name;
      if (fields.description !== undefined)
        updates.description = fields.description;
      if (fields.category !== undefined) updates.category = fields.category;
      if (fields.url !== undefined) {
        if (!isSafeSubmissionUrl(fields.url)) {
          return NextResponse.json(
            { error: 'Primary URL must be a public http(s) address.' },
            { status: 400 },
          );
        }
        updates.url = fields.url;
      }
      if (fields.websiteUrl !== undefined) {
        if (fields.websiteUrl && !isSafeSubmissionUrl(fields.websiteUrl)) {
          return NextResponse.json(
            { error: 'Website URL must be a public http(s) address.' },
            { status: 400 },
          );
        }
        updates.websiteUrl = fields.websiteUrl || null;
        // Admin retargeted the website — the old domain's backlink proof doesn't
        // carry over. The repo README badge is independent, so keep it in the
        // aggregate.
        const badgeRows = await db
          .select({ readmeBadgeOk: servers.readmeBadgeOk })
          .from(servers)
          .where(eq(servers.id, id))
          .limit(1);
        updates.websiteBacklinkOk = false;
        updates.reciprocalBadgeOk = badgeRows[0]?.readmeBadgeOk ?? false;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update.' },
          { status: 400 },
        );
      }

      const updateResult = await db
        .update(servers)
        .set(updates)
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );
      }
    } else if (action === 'unpublish' || action === 'republish') {
      const fromStatus = action === 'unpublish' ? 'active' : 'removed';
      const toStatus = action === 'unpublish' ? 'removed' : 'active';

      const updateResult = await db
        .update(servers)
        .set(
          action === 'republish'
            ? { status: toStatus, redirectTo: null }
            : { status: toStatus },
        )
        .where(and(eq(servers.id, id), eq(servers.status, fromStatus)))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json(
          { error: `Server not found or not currently ${fromStatus}.` },
          { status: 400 },
        );
      }

      // Republished listing should re-enter search indexes promptly.
      if (action === 'republish' && updateResult[0]) {
        void notifyListingIndexed(updateResult[0].id).catch(() => {});
      }
    } else if (action === 'merge_duplicate') {
      const targetId = fields?.targetId?.trim() ?? '';
      const resolved = await resolveCanonicalMergeTarget(
        id,
        targetId,
        async (lookupId) => {
          const rows = await db
            .select({
              id: servers.id,
              status: servers.status,
              redirectTo: servers.redirectTo,
            })
            .from(servers)
            .where(eq(servers.id, lookupId))
            .limit(1);
          return rows[0];
        },
      );
      if ('error' in resolved) {
        const status = resolved.error.includes('not found') ? 404 : 400;
        return NextResponse.json({ error: resolved.error }, { status });
      }

      const updateResult = await db
        .update(servers)
        .set({ status: 'removed', redirectTo: resolved.canonicalId })
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );
      }
    } else if (action === 'delete') {
      const deleteResult = await db
        .delete(servers)
        .where(eq(servers.id, id))
        .returning();

      if (deleteResult.length === 0) {
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );
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
        return NextResponse.json(
          { error: 'days is required.' },
          { status: 400 },
        );
      }

      const rows = await db
        .select({ featuredUntil: servers.featuredUntil })
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);

      if (rows.length === 0) {
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );
      }

      const newFeaturedUntil = computeFeaturedUntil(
        rows[0].featuredUntil,
        days,
      );

      await db
        .update(servers)
        .set({ featuredUntil: newFeaturedUntil })
        .where(eq(servers.id, id));

      return NextResponse.json({
        success: true,
        message: MESSAGES.feature,
        featuredUntil: newFeaturedUntil.toISOString(),
      });
    } else if (action === 'unfeature') {
      await db
        .update(servers)
        .set({ featuredUntil: null })
        .where(eq(servers.id, id));
      return NextResponse.json({
        success: true,
        message: MESSAGES.unfeature,
        featuredUntil: null,
      });
    } else if (action === 'enrich_ai') {
      const rows = await db
        .select()
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      const server = rows[0];
      if (!server)
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );

      const parsedUrl = parseGithubUrl(server.url);
      let readme: string | null = null;
      if (parsedUrl) {
        const token = await getGithubToken();
        readme = await fetchGithubReadme(
          parsedUrl.owner,
          parsedUrl.repo,
          token,
        );
      }
      if (!readme && server.description) {
        readme = server.description;
      }

      const tools = parseServerTools(server.tools);
      const outcome = await generateListingContent({
        name: server.name,
        category: server.category || '',
        url: server.url,
        description: cleanListingDescription(server.description || ''),
        readme: readme || '',
        tools,
      });

      if (outcome.status !== 'ok') {
        return NextResponse.json(
          { error: `AI enrichment failed: ${outcome.reason}` },
          { status: 500 },
        );
      }

      const content = outcome.content;
      const now = new Date();

      const updates: Record<string, any> = {
        aiSummary: content.summary,
        aiOverview: content.overview || null,
        aiUseCases: content.useCases.length
          ? JSON.stringify(content.useCases)
          : null,
        aiFeatures: content.features.length
          ? JSON.stringify(content.features)
          : null,
        aiFaq: content.faq.length ? JSON.stringify(content.faq) : null,
        aiEnvVars: content.envVars.length
          ? JSON.stringify(content.envVars)
          : null,
        aiFaqAt: now,
        aiEnrichedAt: now,
      };
      if (content.pricingModel) updates.pricingModel = content.pricingModel;
      if (content.authType) updates.authType = content.authType;
      if (content.license) updates.license = content.license;
      if (content.tags && content.tags.length > 0)
        updates.tags = JSON.stringify(content.tags);
      if (content.compatibleClients && content.compatibleClients.length > 0) {
        updates.compatibleClients = JSON.stringify(content.compatibleClients);
      }
      if (content.category && server.category === DEFAULT_SUBMIT_CATEGORY) {
        updates.category = content.category;
      }

      updates.installExtractedAt = now;
      const install = content.install;
      if (install) {
        updates.installKind = install.kind;
        updates.installCommand =
          install.kind === 'stdio' ? (install.command ?? null) : null;
        updates.installArgs =
          install.kind === 'stdio' && install.args && install.args.length > 0
            ? JSON.stringify(install.args)
            : null;
        updates.installPackage = install.package ?? null;
        updates.installConfidence = install.confidence;
      } else {
        updates.installKind = null;
        updates.installCommand = null;
        updates.installArgs = null;
        updates.installPackage = null;
        updates.installConfidence = null;
      }

      await db.update(servers).set(updates).where(eq(servers.id, id));

      return NextResponse.json({
        success: true,
        message: `AI content enriched: "${content.summary.slice(0, 75)}..."`,
        aiSummary: content.summary,
        aiOverview: content.overview,
        tags: content.tags,
      });
    } else if (action === 'approve_edit' || action === 'reject_edit') {
      const rows = await db
        .select()
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      const server = rows[0];
      if (!server?.pendingRevision) {
        return NextResponse.json(
          { error: 'No pending edit for this listing.' },
          { status: 400 },
        );
      }

      const pending = parsePendingRevision(server.pendingRevision);
      if (!pending) {
        // Corrupt blob — clear it rather than getting permanently stuck.
        await db
          .update(servers)
          .set({ pendingRevision: null })
          .where(eq(servers.id, id));
        return NextResponse.json(
          { error: 'Stored edit was corrupt and has been cleared.' },
          { status: 400 },
        );
      }

      if (action === 'approve_edit') {
        // Arrays must be JSON-stringified for text columns — never spread raw arrays into D1.
        const fieldUpdates: Record<string, unknown> = {
          ...pendingRevisionToDbPatch(pending.proposed),
          pendingRevision: null,
        };
        if ('websiteUrl' in pending.proposed) {
          // Website changed — reset the website backlink, keep the repo README badge.
          fieldUpdates.websiteBacklinkOk = false;
          fieldUpdates.reciprocalBadgeOk = server.readmeBadgeOk;
        }
        await db.update(servers).set(fieldUpdates).where(eq(servers.id, id));
      } else {
        await db
          .update(servers)
          .set({ pendingRevision: null })
          .where(eq(servers.id, id));
      }

      if (server.ownerUserId) {
        const ownerRows = await db
          .select()
          .from(users)
          .where(eq(users.id, server.ownerUserId))
          .limit(1);
        const ownerEmail = ownerRows[0]?.email;
        if (ownerEmail) {
          await sendNotificationEmail({
            to: ownerEmail,
            heading:
              action === 'approve_edit'
                ? 'Your edit was approved'
                : 'Your edit needs changes',
            message:
              action === 'approve_edit'
                ? `Your changes to ${server.name} are now live.`
                : reason ||
                  `Your proposed changes to ${server.name} were not approved. You can submit a new edit from your dashboard.`,
            actionText: 'View listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }
    } else if (action === 'approve_claim' || action === 'reject_claim') {
      const rows = await db
        .select()
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      const server = rows[0];
      if (!server?.pendingClaimUserId) {
        return NextResponse.json(
          { error: 'No pending claim for this listing.' },
          { status: 400 },
        );
      }

      if (action === 'approve_claim') {
        // pendingClaimWebsiteUrl is null for a GitHub-proven claim (no website
        // was part of that proof) — only overwrite websiteUrl when the claim
        // actually proposed one, so approving a GitHub claim can't null out an
        // existing website. "Verified" (reciprocalBadgeOk) is a separate,
        // cron-managed signal and is intentionally left untouched here.
        const claimUpdates: Record<string, unknown> = {
          isOfficial: true,
          claimedAt: server.claimedAt || new Date(),
          ownerUserId: server.pendingClaimUserId,
          pendingClaimUserId: null,
          pendingClaimWebsiteUrl: null,
        };
        if (server.pendingClaimWebsiteUrl) {
          claimUpdates.websiteUrl = server.pendingClaimWebsiteUrl;
        }
        await db.update(servers).set(claimUpdates).where(eq(servers.id, id));
      } else {
        await db
          .update(servers)
          .set({ pendingClaimUserId: null, pendingClaimWebsiteUrl: null })
          .where(eq(servers.id, id));
      }

      const claimantRows = await db
        .select()
        .from(users)
        .where(eq(users.id, server.pendingClaimUserId))
        .limit(1);
      const claimantEmail = claimantRows[0]?.email;
      if (claimantEmail) {
        await sendNotificationEmail({
          to: claimantEmail,
          heading:
            action === 'approve_claim'
              ? 'Your claim was approved'
              : 'Your claim needs review',
          message:
            action === 'approve_claim'
              ? `Your claim on ${server.name} is now approved — the listing is yours.`
              : reason ||
                `Your claim on ${server.name} wasn't approved. Contact us if you believe this is a mistake.`,
          actionText: 'View listing',
          actionUrl: `${getAppUrl()}/mcp/${id}`,
        });
      }
    } else if (action === 'approve_logo' || action === 'reject_logo') {
      const rows = await db
        .select()
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      const server = rows[0];
      if (!server?.pendingLogoKey) {
        return NextResponse.json(
          { error: 'No pending logo for this listing.' },
          { status: 400 },
        );
      }

      if (action === 'approve_logo') {
        const pendingObject = await env.LOGOS.get(server.pendingLogoKey);
        if (!pendingObject) {
          await db
            .update(servers)
            .set({ pendingLogoKey: null })
            .where(eq(servers.id, id));
          return NextResponse.json(
            { error: 'Pending logo was missing in storage; cleared.' },
            { status: 400 },
          );
        }
        const liveKey = `live/${id}.png`;
        await env.LOGOS.put(liveKey, await pendingObject.arrayBuffer(), {
          httpMetadata: { contentType: 'image/png' },
        });
        await env.LOGOS.delete(server.pendingLogoKey);
        await db
          .update(servers)
          .set({
            logoUrl: `/logos/${id}`,
            logoSource: 'manual',
            pendingLogoKey: null,
          })
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
        await db
          .update(servers)
          .set({ pendingLogoKey: null })
          .where(eq(servers.id, id));
      }

      if (server.ownerUserId) {
        const ownerRows = await db
          .select()
          .from(users)
          .where(eq(users.id, server.ownerUserId))
          .limit(1);
        const ownerEmail = ownerRows[0]?.email;
        if (ownerEmail) {
          await sendNotificationEmail({
            to: ownerEmail,
            heading:
              action === 'approve_logo'
                ? 'Your logo was approved'
                : 'Your logo needs changes',
            message:
              action === 'approve_logo'
                ? `Your new logo for ${server.name} is now live.`
                : reason ||
                  `Your uploaded logo for ${server.name} was not approved. You can upload a different one from your dashboard.`,
            actionText: 'View listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }
    } else if (
      action === 'approve_screenshot' ||
      action === 'reject_screenshot'
    ) {
      const rows = await db
        .select()
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      const server = rows[0];
      if (!server?.pendingScreenshotKey) {
        return NextResponse.json(
          { error: 'No pending screenshot for this listing.' },
          { status: 400 },
        );
      }

      if (action === 'approve_screenshot') {
        const pendingObject = await env.LOGOS.get(server.pendingScreenshotKey);
        if (!pendingObject) {
          await db
            .update(servers)
            .set({ pendingScreenshotKey: null })
            .where(eq(servers.id, id));
          return NextResponse.json(
            { error: 'Pending screenshot was missing in storage; cleared.' },
            { status: 400 },
          );
        }
        const liveKey = `screenshots/live/${id}.png`;
        await env.LOGOS.put(liveKey, await pendingObject.arrayBuffer(), {
          httpMetadata: { contentType: 'image/png' },
        });
        await env.LOGOS.delete(server.pendingScreenshotKey);
        await db
          .update(servers)
          .set({
            screenshotUrl: `/screenshots/${id}`,
            pendingScreenshotKey: null,
          })
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
        await db
          .update(servers)
          .set({ pendingScreenshotKey: null })
          .where(eq(servers.id, id));
      }

      if (server.ownerUserId) {
        const ownerRows = await db
          .select()
          .from(users)
          .where(eq(users.id, server.ownerUserId))
          .limit(1);
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
                : reason ||
                  `Your uploaded screenshot for ${server.name} was not approved. You can upload a different one from your dashboard.`,
            actionText: 'View listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }
    } else if (action === 'toggle_official') {
      const rows = await db
        .select({ isOfficial: servers.isOfficial })
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      if (rows.length === 0)
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );
      const nextOfficial = !rows[0].isOfficial;
      await db
        .update(servers)
        .set({
          isOfficial: nextOfficial,
          claimedAt: nextOfficial ? new Date() : null,
        })
        .where(eq(servers.id, id));
      return NextResponse.json({
        success: true,
        message: `Official badge ${nextOfficial ? 'granted' : 'removed'}.`,
        isOfficial: nextOfficial,
      });
    } else if (action === 'toggle_reciprocal_badge') {
      const rows = await db
        .select({
          reciprocalBadgeOk: servers.reciprocalBadgeOk,
          readmeBadgeOk: servers.readmeBadgeOk,
        })
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      if (rows.length === 0)
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );
      // Manual override targets the website-backlink lever (what grants website
      // dofollow). The aggregate keeps the independent repo README badge on the
      // "off" path so a README-verified listing stays Verified.
      const nextBadge = !rows[0].reciprocalBadgeOk;
      const nextAggregate = nextBadge || rows[0].readmeBadgeOk;
      await db
        .update(servers)
        .set({ websiteBacklinkOk: nextBadge, reciprocalBadgeOk: nextAggregate })
        .where(eq(servers.id, id));
      return NextResponse.json({
        success: true,
        message: `Reciprocal badge ${nextBadge ? 'marked active' : 'marked inactive'}.`,
        reciprocalBadgeOk: nextAggregate,
      });
    } else if (action === 'check_health') {
      const rows = await db
        .select()
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      const server = rows[0];
      if (!server)
        return NextResponse.json(
          { error: 'Server not found.' },
          { status: 404 },
        );

      let healthy = true;
      let repoStatus = 200;
      let websiteStatus: number | null = null;

      try {
        const repoRes = await fetch(server.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(6000),
        }).catch(() => null);
        repoStatus = repoRes?.status || 0;
        if (!repoRes || repoRes.status >= 400) healthy = false;
      } catch {
        healthy = false;
      }

      if (server.websiteUrl) {
        try {
          const webRes = await fetch(server.websiteUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(6000),
          }).catch(() => null);
          websiteStatus = webRes?.status || 0;
          if (!webRes || webRes.status >= 400) healthy = false;
        } catch {
          websiteStatus = 0;
        }
      }

      const nextHealth = healthy ? 'healthy' : 'offline';
      await db
        .update(servers)
        .set({ healthStatus: nextHealth, lastCheckedAt: new Date() })
        .where(eq(servers.id, id));

      return NextResponse.json({
        success: true,
        message: `Health check done. Status: ${nextHealth} (Repo HTTP ${repoStatus}${websiteStatus !== null ? `, Site HTTP ${websiteStatus}` : ''})`,
        healthStatus: nextHealth,
      });
    } else if (
      action === 'approve_review_comment' ||
      action === 'reject_review_comment' ||
      action === 'delete_review'
    ) {
      // `id` here addresses a reviews row, not a servers row — reviews.id is a
      // plain autoincrement integer (see db/schema.ts), unlike every other
      // action's server id, so it needs its own numeric parse.
      const reviewId = Number(id);
      if (!Number.isFinite(reviewId)) {
        return NextResponse.json(
          { error: 'Invalid review id.' },
          { status: 400 },
        );
      }

      const rows = await db
        .select()
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1);
      const review = rows[0];
      if (!review) {
        return NextResponse.json(
          { error: 'Review not found.' },
          { status: 404 },
        );
      }

      if (action === 'delete_review') {
        // Hard delete — the only lever for a rating-only abuse case (e.g. a
        // 1-star rating-bomb with no comment text bypasses comment moderation
        // entirely, since there's no comment to gate).
        await db.delete(reviews).where(eq(reviews.id, reviewId));
      } else {
        await db
          .update(reviews)
          .set({
            commentStatus:
              action === 'approve_review_comment' ? 'approved' : 'rejected',
            updatedAt: new Date(),
          })
          .where(eq(reviews.id, reviewId));

        const [serverRow] = await db
          .select({ name: servers.name })
          .from(servers)
          .where(eq(servers.id, review.serverId))
          .limit(1);
        const [userRow] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, review.userId))
          .limit(1);
        if (userRow?.email && serverRow?.name) {
          await sendNotificationEmail({
            to: userRow.email,
            heading:
              action === 'approve_review_comment'
                ? 'Your review is live'
                : 'Your review comment needs changes',
            message:
              action === 'approve_review_comment'
                ? `Your comment on ${serverRow.name} is now visible to other visitors. Your rating was already counted.`
                : reason ||
                  `Your written comment on ${serverRow.name} wasn't approved for public display. Your star rating still counts as-is — only the comment text was affected.`,
            actionText: 'View listing',
            actionUrl: `${getAppUrl()}/mcp/${review.serverId}`,
          });
        }
      }
    } else if (
      action === 'mark_report_reviewed' ||
      action === 'dismiss_report'
    ) {
      const reportId = Number(id);
      if (!Number.isFinite(reportId)) {
        return NextResponse.json(
          { error: 'Invalid report id.' },
          { status: 400 },
        );
      }

      const updateResult = await db
        .update(reports)
        .set({
          status: action === 'mark_report_reviewed' ? 'reviewed' : 'dismissed',
          reviewedAt: new Date(),
        })
        .where(eq(reports.id, reportId))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json(
          { error: 'Report not found.' },
          { status: 404 },
        );
      }
      // Reports are anonymous — nothing to notify.
    }

    return NextResponse.json({ success: true, message: MESSAGES[action] });
  } catch (error: any) {
    console.error(
      'Admin action error:',
      error?.message || error,
      error?.stack,
      error?.cause,
    );
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
