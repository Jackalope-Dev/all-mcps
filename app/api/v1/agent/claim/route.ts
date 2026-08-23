import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { servers } from '@/db/schema';
import { resolveAgentAuth, hasAgentScope } from '@/lib/agentAuth';
import { isSafeSubmissionUrl } from '@/lib/urlSafety';
import {
  verifyDnsTxt,
  verifyGithubReadme,
  verifyWebsiteHtml,
  websiteHasReciprocalBadge,
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

    if (!hasAgentScope(agent, 'listings:claim')) {
      return NextResponse.json(
        {
          error: 'insufficient_scope',
          message: 'This token was not granted the "listings:claim" scope required to claim a listing.',
          requiredScope: 'listings:claim',
          grantedScopes: agent.scopes,
          docs: 'https://allmcps.com/auth.md',
        },
        { status: 403, headers: CORS_HEADERS }
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

    const resolvedWebsiteUrl = method === 'github' ? null : websiteUrl;

    // The README badge and the website backlink are two independent reciprocal
    // signals — track them separately so a repo proof can't grant the custom
    // site dofollow (and vice versa).
    let readmeBadgeOk = server.readmeBadgeOk;
    let websiteBacklinkOk = server.websiteBacklinkOk;
    if (method === 'github' && server.url.includes('github.com')) {
      // A GitHub claim required the personalized badge in the README (which
      // links to allmcps.com/mcp/{id}), so the repo carries a reciprocal link.
      // This does NOT earn the custom website dofollow, verified separately.
      readmeBadgeOk = true;
    } else if (resolvedWebsiteUrl && (method === 'website_badge' || method === 'dns')) {
      try {
        const siteRes = await fetch(resolvedWebsiteUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'AllMCPs-Verification/1.0 (+https://allmcps.com)' },
          signal: AbortSignal.timeout(6000),
        });
        if (siteRes.ok) {
          websiteBacklinkOk = websiteHasReciprocalBadge(await siteRes.text(), id);
        }
      } catch {
        // Fall back to current website-backlink status
      }
    }
    const earnedReciprocal = readmeBadgeOk || websiteBacklinkOk;

    const claimUpdates: Record<string, unknown> = {
      isOfficial: true,
      ownerUserId: agent.userId,
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

    const methodLabel = method === 'github' ? 'GitHub README' : method === 'dns' ? 'DNS TXT record' : 'site badge';
    const emailEnv = await getEmailEnv();
    const notificationEmail = agent.email || server.submitterEmail;
    const adminEmail = emailEnv.adminEmail;

    if (notificationEmail) {
      const dofollowNote = websiteBacklinkOk
        ? 'Your reciprocal AllMCPs badge was also detected on your website, so your website backlink is active as dofollow!'
        : 'Note: To get a free reciprocal dofollow backlink to your website, place the official AllMCPs badge on your website. Our automated health checker will detect it and upgrade your website link to dofollow automatically.';

      await sendNotificationEmail({
        to: notificationEmail,
        heading: `Agent Claim Approved: ${server.name}`,
        message: `Ownership proof for "${server.name}" was verified via ${methodLabel} and is now official. You have full edit access.\n\n${dofollowNote}`,
        actionText: 'View Listing',
        actionUrl: `${getAppUrl()}/mcp/${id}`,
      });
    }

    if (adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: `Agent Claim Auto-Approved: ${server.name}`,
        message: `${server.name} was automatically claimed by agent user ${notificationEmail || agent.userId} via ${methodLabel}${resolvedWebsiteUrl ? ` (website: ${resolvedWebsiteUrl})` : ''}.${earnedReciprocal ? ' Reciprocal badge detected (dofollow active).' : ''}`,
        actionText: 'View Listing',
        actionUrl: `${getAppUrl()}/mcp/${id}`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        pending: false,
        isOfficial: true,
        reciprocalBadgeOk: earnedReciprocal,
        message: 'Ownership proof verified and claim approved! The listing is now official.',
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
