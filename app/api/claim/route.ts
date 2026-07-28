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

const claimSchema = z.object({
  id: z.string().min(1),
  method: z.enum(['github', 'website_badge', 'dns']).default('github'),
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

    // Resolve website for badge/DNS methods
    let websiteUrl = websiteInput || server.websiteUrl || '';
    if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400 });
    }

    let verification;
    if (method === 'github') {
      verification = await verifyGithubReadme(server.url, id);
    } else if (method === 'website_badge') {
      if (!websiteUrl) {
        return NextResponse.json(
          { error: 'Provide a website URL to verify with a site badge.' },
          { status: 400 }
        );
      }
      verification = await verifyWebsiteHtml(websiteUrl, id);
    } else {
      if (!websiteUrl) {
        return NextResponse.json(
          { error: 'Provide a website URL to verify via DNS TXT.' },
          { status: 400 }
        );
      }
      verification = await verifyDnsTxt(websiteUrl, id);
    }

    if (!verification.ok) {
      return NextResponse.json({ error: verification.reason || 'Verification failed' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      isOfficial: true,
      claimedAt: new Date(),
    };

    if (websiteUrl) {
      updates.websiteUrl = websiteUrl;
    }

    // Website methods prove control of the site
    if (method === 'website_badge' || method === 'dns') {
      updates.websiteVerified = true;
    }

    // If already official, still allow attaching/verifying website
    await db.update(servers).set(updates).where(eq(servers.id, id));

    return NextResponse.json({
      success: true,
      message:
        method === 'github'
          ? 'Successfully claimed via GitHub README. Your listing is now verified.'
          : method === 'dns'
            ? 'Successfully claimed via DNS. Website verified and listing claimed.'
            : 'Successfully claimed via site badge. Website verified and listing claimed.',
      websiteVerified: method === 'website_badge' || method === 'dns',
    });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
