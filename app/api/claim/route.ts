import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { isSafeSubmissionUrl } from '../../../lib/urlSafety';
import {
  verifyDnsTxt,
  verifyGithubReadme,
  verifyWebsiteHtml,
} from '../../../lib/verification';
import { auth } from '../../../lib/auth';
import { sendNotificationEmail, getEmailEnv } from '../../../lib/notify';
import { getAppUrl } from '../../../lib/stripe';

const claimSchema = z.object({
  id: z.string().min(1),
  method: z.enum(['github', 'website_badge', 'dns', 'attach_website']).default('github'),
  /** Optional website to attach/verify when claiming (or update if empty). */
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = claimSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }

    const { id, method } = result.data;
    const websiteInput = (result.data.websiteUrl || '').trim();

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env || !env.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);

    const dbServers = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    const server = dbServers[0];

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required to claim or update a listing.' }, { status: 401 });
    }

    // Resolve website for badge/DNS methods
    let websiteUrl = websiteInput || server.websiteUrl || '';
    if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400 });
    }

    // Attach/update website without re-proving ownership (claimed listings only)
    if (method === 'attach_website') {
      if (!server.isOfficial) {
        return NextResponse.json(
          { error: 'Claim the listing first, then attach a website.' },
          { status: 400 }
        );
      }
      if (server.ownerUserId && server.ownerUserId !== userId) {
        return NextResponse.json({ error: 'Only the listing owner can update its website.' }, { status: 403 });
      }
      if (!websiteInput) {
        return NextResponse.json({ error: 'Provide a website URL.' }, { status: 400 });
      }
      if (!isSafeSubmissionUrl(websiteInput)) {
        return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400 });
      }

      const prev = (server.websiteUrl || '').replace(/\/$/, '');
      const next = websiteInput.replace(/\/$/, '');
      const domainChanged = prev.toLowerCase() !== next.toLowerCase();

      await db
        .update(servers)
        .set({
          websiteUrl: websiteInput,
          // Any reciprocal-badge/dofollow credit earned so far was proven
          // against the old domain, not this one.
          reciprocalBadgeOk: domainChanged ? false : server.reciprocalBadgeOk,
        })
        .where(eq(servers.id, id));

      return NextResponse.json({
        success: true,
        message: domainChanged
          ? 'Website updated. The reciprocal-badge check will pick it up automatically.'
          : 'Website saved.',
      });
    }

    let verification;
    if (method === 'github') {
      verification = await verifyGithubReadme(server.url, id, userId);
    } else if (method === 'website_badge') {
      if (!websiteUrl) {
        return NextResponse.json(
          { error: 'Provide a website URL to verify with a site badge.' },
          { status: 400 }
        );
      }
      verification = await verifyWebsiteHtml(websiteUrl, id, userId);
    } else {
      if (!websiteUrl) {
        return NextResponse.json(
          { error: 'Provide a website URL to verify via DNS TXT.' },
          { status: 400 }
        );
      }
      verification = await verifyDnsTxt(websiteUrl, id, userId);
    }

    if (!verification.ok) {
      return NextResponse.json({ error: verification.reason || 'Verification failed' }, { status: 400 });
    }

    const emailEnv = await getEmailEnv();
    const userEmail = session?.user?.email || server.submitterEmail;
    const adminEmail = emailEnv.adminEmail;

    // Every method proves *control* (of the repo, or of a specific URL), but
    // "Official" is a moderation decision, not just a technical proof — it
    // grants edit rights and a public trust badge — so it always goes through
    // admin review now (see approve_claim/reject_claim in /api/admin/action),
    // regardless of method. The separate "Verified" badge (reciprocal badge
    // presence) is unrelated to this and is checked automatically by cron —
    // see app/api/cron/health/route.ts.
    const resolvedWebsiteUrl = method === 'github' ? null : websiteUrl;
    const prevWebsite = (server.websiteUrl || '').replace(/\/$/, '').toLowerCase();
    const nextWebsite = (resolvedWebsiteUrl || '').replace(/\/$/, '').toLowerCase();
    const domainUnchanged = method === 'github' || prevWebsite === nextWebsite;

    // Already the confirmed owner via this exact proof — re-verifying (e.g. a
    // "Re-verify" button) shouldn't queue a redundant claim or re-notify anyone.
    if (server.isOfficial && server.ownerUserId === userId && domainUnchanged) {
      return NextResponse.json({
        success: true,
        message: 'Ownership already confirmed for this account — nothing to review.',
      });
    }

    // Same user re-submitting the same not-yet-reviewed proof shouldn't re-fire
    // the "pending review" notifications on every click.
    const alreadyPendingSameClaim =
      server.pendingClaimUserId === userId &&
      (server.pendingClaimWebsiteUrl || null) === resolvedWebsiteUrl;

    await db
      .update(servers)
      .set({ pendingClaimUserId: userId, pendingClaimWebsiteUrl: resolvedWebsiteUrl })
      .where(eq(servers.id, id));

    const methodLabel = method === 'github' ? 'GitHub README' : method === 'dns' ? 'DNS TXT record' : 'site badge';

    if (!alreadyPendingSameClaim && userEmail) {
      await sendNotificationEmail({
        to: userEmail,
        heading: `Claim Under Review: ${server.name}`,
        message: `Your ownership proof for "${server.name}" was verified via ${methodLabel}! An admin will review it shortly — we'll email you as soon as it's approved.`,
        actionText: 'View Listing',
        actionUrl: `${getAppUrl()}/mcp/${id}`,
      });
    }

    if (!alreadyPendingSameClaim && adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: `New Pending Claim: ${server.name}`,
        message: `${server.name} has a claim awaiting review by ${userEmail || userId}, proven via ${methodLabel}${resolvedWebsiteUrl ? ` (website: ${resolvedWebsiteUrl})` : ''}.`,
        actionText: 'Review in Admin Panel',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json({
      success: true,
      pending: true,
      message: "Ownership proof verified — pending a quick admin review before it goes live. We'll email you once it's approved.",
    });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
