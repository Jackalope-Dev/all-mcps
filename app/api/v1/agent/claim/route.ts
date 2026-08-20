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

    // Every method proves *control*, but "Official" is a moderation decision
    // (edit rights + a public trust badge), so it always goes through admin
    // review now, regardless of method. "Verified" (reciprocal badge presence)
    // is unrelated and is checked automatically by cron — see
    // app/api/cron/health/route.ts.
    const resolvedWebsiteUrl = method === 'github' ? null : websiteUrl;
    const prevWebsite = (server.websiteUrl || '').replace(/\/$/, '').toLowerCase();
    const nextWebsite = (resolvedWebsiteUrl || '').replace(/\/$/, '').toLowerCase();
    const domainUnchanged = method === 'github' || prevWebsite === nextWebsite;

    // Already the confirmed owner via this exact proof — a repeat agent call
    // shouldn't queue a redundant claim or re-notify anyone.
    if (server.isOfficial && server.ownerUserId === agent.userId && domainUnchanged) {
      return NextResponse.json(
        { success: true, message: 'Ownership already confirmed for this account — nothing to review.' },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Same agent user re-submitting the same not-yet-reviewed proof shouldn't
    // re-fire the "pending review" notifications.
    const alreadyPendingSameClaim =
      server.pendingClaimUserId === agent.userId &&
      (server.pendingClaimWebsiteUrl || null) === resolvedWebsiteUrl;

    await db
      .update(servers)
      .set({ pendingClaimUserId: agent.userId, pendingClaimWebsiteUrl: resolvedWebsiteUrl })
      .where(eq(servers.id, id));

    const methodLabel = method === 'github' ? 'GitHub README' : method === 'dns' ? 'DNS TXT record' : 'site badge';

    if (!alreadyPendingSameClaim && notificationEmail) {
      await sendNotificationEmail({
        to: notificationEmail,
        heading: `Agent Claim Pending Review: ${server.name}`,
        message: `Ownership proof for "${server.name}" was verified via ${methodLabel}! An admin will review it shortly.`,
        actionText: 'View Listing',
        actionUrl: `${getAppUrl()}/mcp/${id}`,
      });
    }

    if (!alreadyPendingSameClaim && adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: `New Pending Agent Claim: ${server.name}`,
        message: `${server.name} has an agent claim awaiting review by ${notificationEmail || agent.userId}, proven via ${methodLabel}${resolvedWebsiteUrl ? ` (website: ${resolvedWebsiteUrl})` : ''}.`,
        actionText: 'Review in Admin Panel',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        pending: true,
        message: "Ownership proof verified. An admin check will complete approval — you'll be notified once it's live.",
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
