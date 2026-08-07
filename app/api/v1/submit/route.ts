import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { z } from 'zod';
import { isSafeSubmissionUrl } from '../../../../lib/urlSafety';
import { DEFAULT_SUBMIT_CATEGORY, normalizeCategory } from '../../../../lib/categories';
import { syncSequenzySubscriber, PRODUCT_SUBSCRIBERS_LIST_ID } from '../../../../lib/sequenzy';
import { sendNotificationEmail, getEmailEnv } from '../../../../lib/notify';
import { getAppUrl } from '../../../../lib/stripe';
import {
  isPricingModel,
  isAuthType,
  isMaintenanceStatus,
  normalizeTags,
  normalizeCompatibleClients,
} from '../../../../lib/serverEnums';

const agentSubmitSchema = z.object({
  url: z.string().optional().or(z.literal('')),
  name: z.string().min(1, 'Server name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  websiteUrl: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v || '').trim()),
  // Same optional enrichment fields as the human submit route — see app/api/submit/route.ts.
  tags: z.array(z.string()).optional(),
  pricingModel: z.string().optional(),
  pricingNotes: z.string().optional(),
  authType: z.string().optional(),
  license: z.string().optional(),
  compatibleClients: z.array(z.string()).optional(),
  maintenanceStatus: z.string().optional(),
  supportUrl: z.string().optional().or(z.literal('')),
  suggestedInstallCommand: z.string().optional(),
  suggestedInstallArgs: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;

    const result = agentSubmitSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid submission data', details: result.error.issues }, { status: 400 });
    }

    const email = result.data.email.trim().toLowerCase();
    let websiteUrl = result.data.websiteUrl || '';
    let name = result.data.name.trim();
    let description = result.data.description || '';
    let category = normalizeCategory(result.data.category);
    let url = (result.data.url || '').trim();

    const tags = normalizeTags(result.data.tags);
    const compatibleClients = normalizeCompatibleClients(result.data.compatibleClients);
    const pricingModel = isPricingModel(result.data.pricingModel) ? result.data.pricingModel : null;
    const authType = isAuthType(result.data.authType) ? result.data.authType : null;
    const maintenanceStatus = isMaintenanceStatus(result.data.maintenanceStatus)
      ? result.data.maintenanceStatus
      : null;
    const pricingNotes = (result.data.pricingNotes || '').trim().slice(0, 280) || null;
    const license = (result.data.license || '').trim().slice(0, 60) || null;
    const suggestedInstallCommand = (result.data.suggestedInstallCommand || '').trim().slice(0, 100) || null;
    const suggestedInstallArgs = (result.data.suggestedInstallArgs || [])
      .filter((a) => typeof a === 'string' && a.trim())
      .map((a) => a.trim())
      .slice(0, 20);
    let supportUrl = (result.data.supportUrl || '').trim();
    if (supportUrl && !isSafeSubmissionUrl(supportUrl)) supportUrl = '';

    if (!url && websiteUrl) {
      url = websiteUrl;
    }
    if (!websiteUrl && url && !url.includes('github.com')) {
      websiteUrl = url;
    }

    if (!url) {
      return NextResponse.json({ error: 'Provide a repository URL and/or website URL.' }, { status: 400 });
    }

    if (!isSafeSubmissionUrl(url)) {
      return NextResponse.json({ error: 'Primary URL must be a public http(s) address.' }, { status: 400 });
    }

    // Auto-fetch GitHub repository details if name/description omitted
    const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (githubMatch) {
      const owner = githubMatch[1];
      let repo = githubMatch[2];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);

      try {
        const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'User-Agent': 'AllMCPs-Directory' },
        });
        if (ghRes.ok) {
          const ghData = (await ghRes.json()) as any;
          if (!name) name = ghData.name;
          if (!description && ghData.description) description = ghData.description;
          if (!websiteUrl && ghData.homepage && isSafeSubmissionUrl(ghData.homepage)) {
            websiteUrl = ghData.homepage;
          }
        }
      } catch {
        /* best-effort */
      }
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `mcp-${Date.now()}`;

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    if (!env || !env.DB) {
      return NextResponse.json({ error: 'Database binding not found' }, { status: 500 });
    }

    const db = drizzle(env.DB as any);

    const insertResult = await db
      .insert(servers)
      .values({
        id,
        name,
        url,
        description: description || 'No description provided.',
        category,
        websiteUrl: websiteUrl || null,
        submitterEmail: email,
        isPremium: false,
        websiteVerified: false,
        isOfficial: false,
        reviewPriority: false,
        premiumStatus: 'free',
        status: 'pending',
        createdAt: new Date(),
        tags: tags.length ? JSON.stringify(tags) : null,
        pricingModel,
        pricingNotes,
        authType,
        license,
        compatibleClients: compatibleClients.length ? JSON.stringify(compatibleClients) : null,
        maintenanceStatus,
        supportUrl: supportUrl || null,
        suggestedInstallCommand,
        suggestedInstallArgs: suggestedInstallArgs.length ? JSON.stringify(suggestedInstallArgs) : null,
      })
      .onConflictDoNothing()
      .returning({ id: servers.id });

    if (insertResult.length === 0) {
      return NextResponse.json(
        { error: `Listing for "${name}" already exists on AllMCPs.` },
        { status: 409 }
      );
    }

    await syncSequenzySubscriber({
      email,
      tags: ['submitted-listing', 'agent-submission'],
      lists: [PRODUCT_SUBSCRIBERS_LIST_ID],
      customAttributes: { serverId: id, serverName: name },
      enrollInSequences: true,
    });

    await sendNotificationEmail({
      to: email,
      heading: `Agent Submission Received: ${name}`,
      message: `Your AI agent has submitted "${name}" to AllMCPs! Your listing is currently queued for review. You can get verified immediately by adding your official AllMCPs badge to your repository or website.`,
      actionText: 'Verify & Claim Listing',
      actionUrl: `${getAppUrl()}/mcp/${id}/claim`,
    });

    const emailEnv = await getEmailEnv();
    if (emailEnv.adminEmail) {
      await sendNotificationEmail({
        to: emailEnv.adminEmail,
        heading: `New Agent Submission: ${name}`,
        message: `An AI agent submitted "${name}" (${url}) for submitter ${email}.`,
        actionText: 'Review in Admin Panel',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    const appUrl = getAppUrl();
    const claimUrl = `${appUrl}/mcp/${id}/claim`;
    const badgeSrc = `${appUrl}/api/badge/${id}?style=shield`;
    const badgeMarkdown = `[![AllMCPs Verified](${badgeSrc})](${appUrl}/mcp/${id})`;

    return NextResponse.json({
      success: true,
      message: `Server "${name}" submitted successfully via Agent API!`,
      id,
      name,
      url,
      category,
      status: 'pending',
      claim_url: claimUrl,
      badge_markdown: badgeMarkdown,
    });
  } catch (e: any) {
    console.error('Agent submission error:', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
