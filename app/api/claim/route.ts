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
          // New domain needs re-verification
          websiteVerified: domainChanged ? false : server.websiteVerified,
        })
        .where(eq(servers.id, id));

      return NextResponse.json({
        success: true,
        message: domainChanged
          ? 'Website updated. Verify it with a site badge or DNS TXT when ready.'
          : 'Website saved.',
        websiteVerified: domainChanged ? false : !!server.websiteVerified,
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

    // GitHub proof is tied to real repo write access — always auto-approve.
    if (method === 'github') {
      // Already claimed & verified by this same owner — re-verification (e.g. the
      // "Re-verify Repo Ownership" button) shouldn't re-fire claim notifications.
      const alreadyClaimedByUser = server.isOfficial && server.ownerUserId === userId;

      await db
        .update(servers)
        .set({
          isOfficial: true,
          claimedAt: server.claimedAt || new Date(),
          ownerUserId: userId,
        })
        .where(eq(servers.id, id));

      if (!alreadyClaimedByUser) {
        if (userEmail) {
          await sendNotificationEmail({
            to: userEmail,
            heading: `Listing Verified & Claimed: ${server.name}`,
            message: `Congratulations! Your ownership proof for "${server.name}" was successfully verified via GitHub README. Your listing now features the Verified badge on AllMCPs.`,
            actionText: 'View Listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }

        if (adminEmail) {
          await sendNotificationEmail({
            to: adminEmail,
            heading: `Listing Claimed: ${server.name}`,
            message: `"${server.name}" was successfully claimed and verified via GitHub README by ${userEmail || userId}.`,
            actionText: 'View Listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully claimed via GitHub README. Your listing is now verified.',
        websiteVerified: false,
      });
    }

    // Website/DNS proof only shows this user controls *some* site — reconfirming
    // the site already on file is auto-approved (unchanged from today), but a
    // new/different site doesn't establish any relationship to the actual
    // project, so it queues for a human check instead of granting ownership.
    const existingWebsite = (server.websiteUrl || '').replace(/\/$/, '').toLowerCase();
    const provenWebsite = websiteUrl.replace(/\/$/, '').toLowerCase();
    const isExistingWebsite = !!existingWebsite && existingWebsite === provenWebsite;

    if (isExistingWebsite) {
      // Already claimed & this exact website already verified by this owner —
      // re-verification shouldn't re-fire claim notifications.
      const alreadyClaimedByUser =
        server.isOfficial && server.ownerUserId === userId && !!server.websiteVerified;

      await db
        .update(servers)
        .set({
          isOfficial: true,
          claimedAt: server.claimedAt || new Date(),
          ownerUserId: userId,
          websiteUrl,
          websiteVerified: true,
        })
        .where(eq(servers.id, id));

      if (!alreadyClaimedByUser) {
        if (userEmail) {
          await sendNotificationEmail({
            to: userEmail,
            heading: `Listing Verified & Claimed: ${server.name}`,
            message: `Congratulations! Your ownership proof for "${server.name}" was successfully verified via ${method === 'dns' ? 'DNS TXT record' : 'site badge'}. Your listing now features the Verified badge on AllMCPs.`,
            actionText: 'View Listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }

        if (adminEmail) {
          await sendNotificationEmail({
            to: adminEmail,
            heading: `Listing Claimed: ${server.name}`,
            message: `"${server.name}" was successfully claimed and verified via ${method} by ${userEmail || userId}.`,
            actionText: 'View Listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message:
          method === 'dns'
            ? 'Successfully claimed via DNS. Website verified and listing claimed.'
            : 'Successfully claimed via site badge. Website verified and listing claimed.',
        websiteVerified: true,
      });
    }

    // Same user re-submitting the same not-yet-reviewed website shouldn't
    // re-fire the "pending review" notifications.
    const alreadyPendingSameClaim =
      server.pendingClaimUserId === userId && server.pendingClaimWebsiteUrl === websiteUrl;

    await db
      .update(servers)
      .set({ pendingClaimUserId: userId, pendingClaimWebsiteUrl: websiteUrl })
      .where(eq(servers.id, id));

    if (!alreadyPendingSameClaim && userEmail) {
      await sendNotificationEmail({
        to: userEmail,
        heading: `Claim Under Review: ${server.name}`,
        message: `Your ownership proof for "${server.name}" was received! Because this claim includes a new website URL (${websiteUrl}), an admin will perform a quick review before approving it. We'll notify you as soon as it's approved.`,
        actionText: 'View Listing',
        actionUrl: `${getAppUrl()}/mcp/${id}`,
      });
    }

    if (!alreadyPendingSameClaim && adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: `New Pending Claim: ${server.name}`,
        message: `${server.name} has a claim awaiting review by ${userEmail || userId} (new website: ${websiteUrl}).`,
        actionText: 'Review in Admin Panel',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json({
      success: true,
      pending: true,
      message:
        "Ownership proof verified — since this is a new website for this listing, it needs a quick admin check before it goes live. We'll email you once it's approved.",
      websiteVerified: false,
    });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
