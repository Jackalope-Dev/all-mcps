import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { servers } from '@/db/schema';
import { resolveAgentAuth } from '@/lib/agentAuth';
import { isSafeSubmissionUrl } from '@/lib/urlSafety';
import {
  verifyDnsTxt,
  verifyGithubReadme,
  verifyWebsiteHtml,
} from '@/lib/verification';
import { getClaimVerificationToken } from '@/lib/verificationTokens';
import { sendNotificationEmail, getEmailEnv } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const claimSchema = z.object({
  id: z.string().min(1, 'Listing ID is required'),
  method: z.enum(['dns', 'website_badge', 'github']).default('dns'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  try {
    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500, headers: CORS_HEADERS });
    }

    if (!env || !env.DB) {
      return NextResponse.json({ error: 'Database binding not found' }, { status: 500, headers: CORS_HEADERS });
    }

    const db = drizzle(env.DB as any);

    // Authenticate Agent via Authorization header
    const authHeader = req.headers.get('Authorization');
    const agent = await resolveAgentAuth(db, authHeader);

    if (!agent) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          message: 'Valid Agent Bearer token required in Authorization header. Register at /api/v1/agent/register.',
          docs: 'https://allmcps.com/auth.md',
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const result = claimSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid claim payload', details: result.error.issues },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { id, method } = result.data;
    const websiteInput = (result.data.websiteUrl || '').trim();

    const dbServers = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    const server = dbServers[0];

    if (!server) {
      return NextResponse.json({ error: `Listing '${id}' not found.` }, { status: 404, headers: CORS_HEADERS });
    }

    let websiteUrl = websiteInput || server.websiteUrl || '';
    if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400, headers: CORS_HEADERS });
    }

    const expectedToken = getClaimVerificationToken(id, agent.userId);

    let verification: { ok: boolean; reason?: string };
    if (method === 'github') {
      verification = await verifyGithubReadme(server.url, id, agent.userId);
    } else if (method === 'website_badge') {
      if (!websiteUrl) {
        return NextResponse.json(
          { error: 'Provide a website URL to verify via site badge.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      verification = await verifyWebsiteHtml(websiteUrl, id, agent.userId);
    } else {
      if (!websiteUrl) {
        return NextResponse.json(
          { error: 'Provide a website URL to verify via DNS TXT record.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      verification = await verifyDnsTxt(websiteUrl, id, agent.userId);
    }

    if (!verification.ok) {
      return NextResponse.json(
        {
          error: verification.reason || 'Verification failed',
          instructions: {
            method,
            requiredTxtRecord: method === 'dns' ? expectedToken : undefined,
            requiredMetaTag: method === 'website_badge' ? `<meta name="allmcps-verification" content="${expectedToken}">` : undefined,
            requiredReadmeBadge: method === 'github' ? `Badge containing link to allmcps.com/mcp/${id} and verify=${agent.userId}` : undefined,
          },
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const emailEnv = await getEmailEnv();
    const notificationEmail = agent.email || server.submitterEmail;
    const adminEmail = emailEnv.adminEmail;

    // GitHub README claim -> Auto-approve
    if (method === 'github') {
      // Already claimed & verified by this same owner — a repeat agent call
      // (retry, re-run) shouldn't re-fire claim notifications.
      const alreadyClaimedByUser = server.isOfficial && server.ownerUserId === agent.userId;

      await db
        .update(servers)
        .set({
          isOfficial: true,
          claimedAt: server.claimedAt || new Date(),
          ownerUserId: agent.userId,
        })
        .where(eq(servers.id, id));

      if (!alreadyClaimedByUser) {
        if (notificationEmail) {
          await sendNotificationEmail({
            to: notificationEmail,
            heading: `Listing Verified & Claimed via Agent: ${server.name}`,
            message: `Congratulations! Your agent successfully verified ownership for "${server.name}" via GitHub README. Your listing now features the Verified badge on AllMCPs.`,
            actionText: 'View Listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }

        if (adminEmail) {
          await sendNotificationEmail({
            to: adminEmail,
            heading: `Agent Claimed Listing: ${server.name}`,
            message: `"${server.name}" was successfully claimed and verified via GitHub README by Agent (user: ${notificationEmail || agent.userId}).`,
            actionText: 'View Listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Successfully claimed via GitHub README. Your listing is now verified.',
          websiteVerified: false,
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Website / DNS proof logic
    const existingWebsite = (server.websiteUrl || '').replace(/\/$/, '').toLowerCase();
    const provenWebsite = websiteUrl.replace(/\/$/, '').toLowerCase();
    const isExistingWebsite = !!existingWebsite && existingWebsite === provenWebsite;

    if (isExistingWebsite) {
      // Already claimed & this exact website already verified by this owner —
      // a repeat agent call shouldn't re-fire claim notifications.
      const alreadyClaimedByUser =
        server.isOfficial && server.ownerUserId === agent.userId && !!server.websiteVerified;

      await db
        .update(servers)
        .set({
          isOfficial: true,
          claimedAt: server.claimedAt || new Date(),
          ownerUserId: agent.userId,
          websiteUrl,
          websiteVerified: true,
        })
        .where(eq(servers.id, id));

      if (!alreadyClaimedByUser) {
        if (notificationEmail) {
          await sendNotificationEmail({
            to: notificationEmail,
            heading: `Listing Verified & Claimed via Agent: ${server.name}`,
            message: `Congratulations! Your agent successfully verified ownership for "${server.name}" via ${method === 'dns' ? 'DNS TXT record' : 'site badge'}. Your listing now features the Verified badge on AllMCPs.`,
            actionText: 'View Listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }

        if (adminEmail) {
          await sendNotificationEmail({
            to: adminEmail,
            heading: `Agent Claimed Listing: ${server.name}`,
            message: `"${server.name}" was successfully claimed via ${method} by Agent (user: ${notificationEmail || agent.userId}).`,
            actionText: 'View Listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }

      return NextResponse.json(
        {
          success: true,
          message: method === 'dns'
            ? 'Successfully claimed listing via DNS TXT. Website verified and listing marked official.'
            : 'Successfully claimed listing via site badge. Website verified and listing marked official.',
          websiteVerified: true,
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Same agent user re-submitting the same not-yet-reviewed website
    // shouldn't re-fire the "pending review" notifications.
    const alreadyPendingSameClaim =
      server.pendingClaimUserId === agent.userId && server.pendingClaimWebsiteUrl === websiteUrl;

    // New website URL needs quick admin check
    await db
      .update(servers)
      .set({ pendingClaimUserId: agent.userId, pendingClaimWebsiteUrl: websiteUrl })
      .where(eq(servers.id, id));

    if (!alreadyPendingSameClaim && notificationEmail) {
      await sendNotificationEmail({
        to: notificationEmail,
        heading: `Agent Claim Pending Review: ${server.name}`,
        message: `Ownership proof for "${server.name}" was verified via ${method}! Because this claim includes a new website URL (${websiteUrl}), an admin will perform a quick review before approving it.`,
        actionText: 'View Listing',
        actionUrl: `${getAppUrl()}/mcp/${id}`,
      });
    }

    if (!alreadyPendingSameClaim && adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: `New Pending Agent Claim: ${server.name}`,
        message: `${server.name} has an agent claim awaiting review by ${notificationEmail || agent.userId} (new website: ${websiteUrl}).`,
        actionText: 'Review in Admin Panel',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        pending: true,
        message: "Ownership proof verified. Because this claim provides a new website for this listing, an admin check will complete approval.",
        websiteVerified: false,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (e: any) {
    console.error('Agent claim error:', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'Programmatic agent claim accepts POST requests with Authorization: Bearer <token>. Verification methods: "dns" (default), "website_badge", or "github".',
      required_header: 'Authorization: Bearer YOUR_AGENT_TOKEN',
      example_body: {
        id: 'example-mcp',
        method: 'dns',
        websiteUrl: 'https://example.com',
      },
      docs: 'https://allmcps.com/auth.md',
    },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
