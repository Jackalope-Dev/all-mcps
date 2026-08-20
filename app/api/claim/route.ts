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
  websiteHasReciprocalBadge,
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

    const resolvedWebsiteUrl = method === 'github' ? null : websiteUrl;

    // Check if the site or repo carries a reciprocal badge for instant dofollow credit
    let earnedReciprocal = server.reciprocalBadgeOk;
    if (method === 'github' && server.url.includes('github.com')) {
      earnedReciprocal = true;
    } else if (resolvedWebsiteUrl && (method === 'website_badge' || method === 'dns')) {
      try {
        const siteRes = await fetch(resolvedWebsiteUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'AllMCPs-Verification/1.0 (+https://allmcps.com)' },
          signal: AbortSignal.timeout(6000),
        });
        if (siteRes.ok) {
          earnedReciprocal = websiteHasReciprocalBadge(await siteRes.text(), id);
        }
      } catch {
        // Fall back to current reciprocal status
      }
    }

    const claimUpdates: Record<string, unknown> = {
      isOfficial: true,
      ownerUserId: userId,
      claimedAt: server.claimedAt || new Date(),
      pendingClaimUserId: null,
      pendingClaimWebsiteUrl: null,
      reciprocalBadgeOk: earnedReciprocal,
    };
    if (resolvedWebsiteUrl) {
      claimUpdates.websiteUrl = resolvedWebsiteUrl;
    }

    await db.update(servers).set(claimUpdates).where(eq(servers.id, id));

    const methodLabel = method === 'github' ? 'GitHub README' : method === 'dns' ? 'DNS TXT record' : 'site badge / meta tag';
    const emailEnv = await getEmailEnv();
    const userEmail = session?.user?.email || server.submitterEmail;
    const adminEmail = emailEnv.adminEmail;

    if (userEmail) {
      const dofollowNote = earnedReciprocal
        ? 'Your reciprocal AllMCPs badge was also detected, so your website backlink is active as dofollow!'
        : 'Note: To get a free reciprocal dofollow backlink to your website, place the official AllMCPs badge on your website or README. Our automated health checker will detect it and upgrade your link to dofollow automatically.';

      await sendNotificationEmail({
        to: userEmail,
        heading: `Listing Verified: ${server.name}`,
        message: `Congratulations! Your ownership of "${server.name}" has been verified via ${methodLabel} and is now official. You have full edit access in your dashboard.\n\n${dofollowNote}`,
        actionText: 'Manage in Dashboard',
        actionUrl: `${getAppUrl()}/dashboard`,
      });
    }

    if (adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: `Listing Claim Auto-Approved: ${server.name}`,
        message: `${server.name} was automatically verified and claimed by ${userEmail || userId} via ${methodLabel}${resolvedWebsiteUrl ? ` (website: ${resolvedWebsiteUrl})` : ''}.${earnedReciprocal ? ' Reciprocal badge detected (dofollow active).' : ''}`,
        actionText: 'View Listing',
        actionUrl: `${getAppUrl()}/mcp/${id}`,
      });
    }

    return NextResponse.json({
      success: true,
      pending: false,
      isOfficial: true,
      reciprocalBadgeOk: earnedReciprocal,
      message: 'Ownership verified! Your listing is now official and you have full management access.',
    });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
