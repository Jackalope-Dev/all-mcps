import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { servers } from '../db/schema';
import { auth } from './auth';
import { getEmailEnv, sendNotificationEmail } from './notify';
import { isGitHubRepoUrl } from './repoUrl';
import { getAppUrl } from './stripe';
import { isSafeSubmissionUrl } from './urlSafety';
import {
  verifyDnsTxt,
  verifyGithubReadme,
  verifyWebsiteHtml,
  websiteHasReciprocalBadge,
} from './verification';
import { formatZodError } from './zodError';

const claimSchema = z.object({
  id: z.string().min(1),
  method: z
    .enum(['github', 'website_badge', 'dns', 'attach_website'])
    .default('github'),
  /** Optional website to attach/verify when claiming (or update if empty). */
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

export type ClaimListingOutcome =
  | { ok: true; status: 200; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Core claim/verify logic, shared by the `/api/claim` HTTP route and the
 * `verify_mcp_claim` MCP tool. See lib/submitListing.ts for why this must be
 * called in-process rather than via a same-zone `fetch()` back to this own
 * deployment. Reads the signed-in session via `auth()`, which resolves
 * against the request currently being handled (the caller's own Route
 * Handler invocation) — so an MCP tool call with no session cookie correctly
 * surfaces "sign in required" rather than silently failing.
 *
 * `identityOverride`, when given, skips the `auth()` cookie lookup entirely
 * and claims as that identity instead — this is how an agent bearer token
 * (see lib/agentAuth.ts) can drive a claim with no browser session at all.
 */
export async function claimListing(
  rawBody: unknown,
  identityOverride?: { userId: string; email: string | null },
): Promise<ClaimListingOutcome> {
  try {
    const result = claimSchema.safeParse(rawBody);

    if (!result.success) {
      return {
        ok: false,
        status: 400,
        body: { error: formatZodError(result.error) },
      };
    }

    const { id, method } = result.data;
    const websiteInput = (result.data.websiteUrl || '').trim();

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

    const dbServers = await db
      .select()
      .from(servers)
      .where(eq(servers.id, id))
      .limit(1);
    const server = dbServers[0];

    if (!server) {
      return { ok: false, status: 404, body: { error: 'Server not found' } };
    }

    // A pre-resolved agent-token identity always wins over (and skips) the
    // cookie-session lookup — an MCP/agent caller has no browser session.
    const session = identityOverride ? null : await auth();
    const userId = identityOverride?.userId ?? session?.user?.id;
    if (!userId) {
      return {
        ok: false,
        status: 401,
        body: { error: 'Sign in required to claim or update a listing.' },
      };
    }

    // Resolve website for badge/DNS methods
    const websiteUrl = websiteInput || server.websiteUrl || '';
    if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
      return {
        ok: false,
        status: 400,
        body: { error: 'Website URL must be a public http(s) address.' },
      };
    }

    // Attach/update website without re-proving ownership (claimed listings only)
    if (method === 'attach_website') {
      if (!server.isOfficial) {
        return {
          ok: false,
          status: 400,
          body: { error: 'Claim the listing first, then attach a website.' },
        };
      }
      if (server.ownerUserId && server.ownerUserId !== userId) {
        return {
          ok: false,
          status: 403,
          body: { error: 'Only the listing owner can update its website.' },
        };
      }
      if (!websiteInput) {
        return {
          ok: false,
          status: 400,
          body: { error: 'Provide a website URL.' },
        };
      }
      if (!isSafeSubmissionUrl(websiteInput)) {
        return {
          ok: false,
          status: 400,
          body: { error: 'Website URL must be a public http(s) address.' },
        };
      }

      const prev = (server.websiteUrl || '').replace(/\/$/, '');
      const next = websiteInput.replace(/\/$/, '');
      const domainChanged = prev.toLowerCase() !== next.toLowerCase();

      await db
        .update(servers)
        .set({
          websiteUrl: websiteInput,
          // Any website-backlink/dofollow credit earned so far was proven
          // against the old domain, not this one. The repo README badge is
          // unaffected by a website change, so the aggregate keeps that signal.
          ...(domainChanged
            ? {
                websiteBacklinkOk: false,
                reciprocalBadgeOk: server.readmeBadgeOk,
              }
            : {}),
        })
        .where(eq(servers.id, id));

      return {
        ok: true,
        status: 200,
        body: {
          success: true,
          message: domainChanged
            ? 'Website updated. The reciprocal-badge check will pick it up automatically.'
            : 'Website saved.',
        },
      };
    }

    let verification: { ok: boolean; reason?: string };
    if (method === 'github') {
      verification = await verifyGithubReadme(server.url, id, userId);
    } else if (method === 'website_badge') {
      if (!websiteUrl) {
        return {
          ok: false,
          status: 400,
          body: { error: 'Provide a website URL to verify with a site badge.' },
        };
      }
      verification = await verifyWebsiteHtml(websiteUrl, id, userId);
    } else {
      if (!websiteUrl) {
        return {
          ok: false,
          status: 400,
          body: { error: 'Provide a website URL to verify via DNS TXT.' },
        };
      }
      verification = await verifyDnsTxt(websiteUrl, id, userId);
    }

    if (!verification.ok) {
      return {
        ok: false,
        status: 400,
        body: { error: verification.reason || 'Verification failed' },
      };
    }

    const resolvedWebsiteUrl = method === 'github' ? null : websiteUrl;

    // The README badge and the website backlink are two independent reciprocal
    // signals — track them separately so a repo proof can't grant the custom
    // site dofollow (and vice versa).
    let readmeBadgeOk = server.readmeBadgeOk;
    let websiteBacklinkOk = server.websiteBacklinkOk;
    if (method === 'github' && isGitHubRepoUrl(server.url)) {
      // A GitHub claim required the personalized badge in the README, which
      // links to allmcps.com/mcp/{id} — so the repo demonstrably carries a
      // reciprocal link. This does NOT earn the custom website dofollow; that
      // requires the website's own backlink, verified separately below.
      readmeBadgeOk = true;
    } else if (
      resolvedWebsiteUrl &&
      (method === 'website_badge' || method === 'dns')
    ) {
      try {
        const siteRes = await fetch(resolvedWebsiteUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'AllMCPs-Verification/1.0 (+https://allmcps.com)',
          },
          signal: AbortSignal.timeout(6000),
        });
        if (siteRes.ok) {
          websiteBacklinkOk = websiteHasReciprocalBadge(
            await siteRes.text(),
            id,
          );
        }
      } catch {
        // Fall back to current website-backlink status
      }
    }
    const earnedReciprocal = readmeBadgeOk || websiteBacklinkOk;

    const claimUpdates: Record<string, unknown> = {
      isOfficial: true,
      ownerUserId: userId,
      claimedAt: server.claimedAt || new Date(),
      pendingClaimUserId: null,
      pendingClaimWebsiteUrl: null,
      reciprocalBadgeOk: earnedReciprocal,
      readmeBadgeOk,
      websiteBacklinkOk,
    };
    if (resolvedWebsiteUrl) {
      claimUpdates.websiteUrl = resolvedWebsiteUrl;
    }

    await db.update(servers).set(claimUpdates).where(eq(servers.id, id));

    const methodLabel =
      method === 'github'
        ? 'GitHub README'
        : method === 'dns'
          ? 'DNS TXT record'
          : 'site badge / meta tag';
    const emailEnv = await getEmailEnv();
    const userEmail =
      identityOverride?.email || session?.user?.email || server.submitterEmail;
    const adminEmail = emailEnv.adminEmail;

    if (userEmail) {
      const dofollowNote = websiteBacklinkOk
        ? 'Your reciprocal AllMCPs badge was also detected on your website, so your website backlink is active as dofollow!'
        : 'Note: To get a free reciprocal dofollow backlink to your website, place the official AllMCPs badge on your website. Our automated health checker will detect it and upgrade your website link to dofollow automatically.';

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

    return {
      ok: true,
      status: 200,
      body: {
        success: true,
        pending: false,
        isOfficial: true,
        reciprocalBadgeOk: earnedReciprocal,
        message:
          'Ownership verified! Your listing is now official and you have full management access.',
      },
    };
  } catch (error) {
    console.error('Claim error:', error);
    return {
      ok: false,
      status: 500,
      body: { error: 'Internal Server Error' },
    };
  }
}
