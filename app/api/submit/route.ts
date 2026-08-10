import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../db/schema';
import { z } from 'zod';
import { isSafeSubmissionUrl } from '../../../lib/urlSafety';
import { findExistingListingByUrl } from '../../../lib/urlDedup';
import { DEFAULT_SUBMIT_CATEGORY, normalizeCategory } from '../../../lib/categories';
import { syncSequenzySubscriber, PRODUCT_SUBSCRIBERS_LIST_ID } from '../../../lib/sequenzy';
import { sendNotificationEmail, getEmailEnv } from '../../../lib/notify';
import { getAppUrl } from '../../../lib/stripe';
import {
  isPricingModel,
  isAuthType,
  isMaintenanceStatus,
  normalizeTags,
  normalizeCompatibleClients,
} from '../../../lib/serverEnums';

const submitSchema = z.object({
  url: z.string().optional().or(z.literal('')),
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  websiteUrl: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v || '').trim())
    .refine((v) => !v || z.string().url().safeParse(v).success, {
      message: 'Website must be a valid URL',
    }),
  // Optional submitter-controlled enrichment fields. Kept loosely typed here and
  // coerced/validated below (same "always coerce to something valid" approach as
  // `category`) rather than rejecting the whole submission over a malformed extra.
  tags: z.array(z.string()).optional(),
  pricingModel: z.string().optional(),
  pricingNotes: z.string().optional(),
  authType: z.string().optional(),
  license: z.string().optional(),
  compatibleClients: z.array(z.string()).optional(),
  maintenanceStatus: z.string().optional(),
  supportUrl: z.string().optional().or(z.literal('')),
  /** Optional hosted MCP endpoint offered alongside the primary install (see db/schema.ts). */
  remoteEndpointUrl: z.string().optional().or(z.literal('')),
  suggestedInstallCommand: z.string().optional(),
  suggestedInstallArgs: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    let env: any;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      /* fallback */
    }

    const body = (await req.json()) as any;
    const token = body['cf-turnstile-response'];

    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing Turnstile token' }, { status: 400 });
    }

    const verifyForm = new URLSearchParams();
    verifyForm.append('secret', env?.TURNSTILE_SECRET || process.env.TURNSTILE_SECRET || '');
    verifyForm.append('response', token);
    verifyForm.append('remoteip', req.headers.get('x-forwarded-for') || '');

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyForm,
    });

    const verifyResult = (await verifyRes.json()) as any;
    if (!verifyResult.success) {
      return NextResponse.json({ success: false, error: 'Turnstile verification failed' }, { status: 403 });
    }

    const result = submitSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }

    const email = result.data.email.trim().toLowerCase();
    let websiteUrl = result.data.websiteUrl || '';
    let name = result.data.name || '';
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
    // Supplementary link — drop silently if unsafe/malformed rather than failing the submission over it.
    let supportUrl = (result.data.supportUrl || '').trim();
    if (supportUrl && !isSafeSubmissionUrl(supportUrl)) supportUrl = '';
    let remoteEndpointUrl = (result.data.remoteEndpointUrl || '').trim();
    if (remoteEndpointUrl && !isSafeSubmissionUrl(remoteEndpointUrl)) remoteEndpointUrl = '';

    // Website-only: use website as primary url when repo omitted
    if (!url && websiteUrl) {
      url = websiteUrl;
    }
    if (!websiteUrl && url && !url.includes('github.com')) {
      websiteUrl = url;
    }

    if (!url) {
      return NextResponse.json(
        { error: 'Provide a repository URL and/or website URL.' },
        { status: 400 }
      );
    }

    if (!isSafeSubmissionUrl(url)) {
      return NextResponse.json({ error: 'Primary URL must be a public http(s) address.' }, { status: 400 });
    }

    if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400 });
    }

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
      } catch (e) {
        console.error('GitHub API fetch failed', e);
      }
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Name could not be auto-filled, please provide it manually.' },
        { status: 400 }
      );
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `mcp-${Date.now()}`;

    if (!env) {
      try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const ctx = await getCloudflareContext();
        env = ctx.env;
      } catch (e) {
        throw new Error('Could not get Cloudflare context.');
      }
    }

    if (!env || !env.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);

    // Safety net for whoever skips the prefill step's duplicate check (or edits
    // the URL afterward) — blocks re-adding a server that's already listed,
    // including a 'removed' (dead-link) one, in favor of pointing them at the
    // claim flow for the existing row instead of creating a second one.
    const existingByUrl = await findExistingListingByUrl(db, url);
    if (existingByUrl) {
      return NextResponse.json(
        {
          error: `This URL is already listed as "${existingByUrl.name}" (${existingByUrl.status}). Visit /mcp/${existingByUrl.id} to view or claim it instead of submitting a duplicate.`,
          duplicate: true,
          existing: existingByUrl,
        },
        { status: 409 }
      );
    }

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
        remoteEndpointUrl: remoteEndpointUrl || null,
        suggestedInstallCommand,
        suggestedInstallArgs: suggestedInstallArgs.length ? JSON.stringify(suggestedInstallArgs) : null,
      })
      .onConflictDoNothing()
      .returning({ id: servers.id });

    if (insertResult.length === 0) {
      // Slug collision: another listing already has this id. Nothing was written, so
      // don't sync Sequenzy — the customAttributes would point at someone else's listing.
      return NextResponse.json(
        { error: 'A listing with a matching name already exists. Please contact us if this is unexpected.' },
        { status: 409 }
      );
    }

    await syncSequenzySubscriber({
      email,
      tags: ['submitted-listing'],
      lists: [PRODUCT_SUBSCRIBERS_LIST_ID],
      customAttributes: { serverId: id, serverName: name },
      enrollInSequences: true,
    });

    // 1. Send confirmation email to the submitter
    await sendNotificationEmail({
      to: email,
      heading: `Submission Received: ${name}`,
      message: `Thank you for submitting "${name}" to AllMCPs! Your listing is currently queued for review. You can get verified immediately by adding your official AllMCPs badge to your repository or website.`,
      actionText: 'Verify & Claim Listing',
      actionUrl: `${getAppUrl()}/mcp/${id}/claim`,
    });

    // 2. Send alert email to the admin
    const emailEnv = await getEmailEnv();
    const adminEmail = emailEnv.adminEmail;
    if (adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: `New MCP Submission: ${name}`,
        message: `A new MCP server "${name}" (${url}) was submitted by ${email}.`,
        actionText: 'Review in Admin Panel',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Server submitted successfully for review!',
      id,
    });
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
