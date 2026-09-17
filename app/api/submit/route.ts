import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { servers } from '../../../db/schema';
import { prepareListingIntake } from '../../../lib/listingIntake';
import { getEmailEnv, sendNotificationEmail } from '../../../lib/notify';
import {
  checkRateLimit,
  clientKey,
  rateLimitHeaders,
} from '../../../lib/rateLimit';
import {
  NEWSLETTER_SUBSCRIBERS_LIST_ID,
  PRODUCT_SUBSCRIBERS_LIST_ID,
  syncSequenzySubscriber,
} from '../../../lib/sequenzy';
import { getAppUrl } from '../../../lib/stripe';
import { verifyTurnstileToken } from '../../../lib/turnstile';
import { formatZodError } from '../../../lib/zodError';

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
  // Checkbox on the submit form, pre-checked by default; absent (e.g. older
  // clients/the agent API) is treated the same as checked.
  newsletterOptIn: z.boolean().optional(),
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
    const turnstileResult = await verifyTurnstileToken(
      body['cf-turnstile-response'],
      env,
      req.headers.get('x-forwarded-for') || '',
    );
    if (!turnstileResult.ok) {
      return NextResponse.json(
        { success: false, error: turnstileResult.error },
        { status: turnstileResult.status },
      );
    }

    // Turnstile proves "not a bot"; it does not cap how many submissions one
    // caller can push through. The agent path has always had this limit.
    const rateLimit = checkRateLimit(`submit:${clientKey(req)}`, 5, 3600);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many submissions from this connection. Try again in ${rateLimit.resetSeconds}s.`,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(rateLimit),
            'Retry-After': String(rateLimit.resetSeconds),
          },
        },
      );
    }

    const result = submitSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 },
      );
    }

    const email = result.data.email.trim().toLowerCase();

    if (!env) {
      try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const ctx = await getCloudflareContext();
        env = ctx.env;
      } catch {
        throw new Error('Could not get Cloudflare context.');
      }
    }
    if (!env?.DB) {
      throw new Error('Database binding not found');
    }
    const db = drizzle(env.DB as any);

    const prepared = await prepareListingIntake(result.data, db, env);
    if (!prepared.ok) {
      return NextResponse.json(prepared.body, { status: prepared.status });
    }
    const { id, name, url } = prepared;

    const insertResult = await db
      .insert(servers)
      .values(prepared.values as any)
      .onConflictDoNothing()
      .returning({ id: servers.id });

    if (insertResult.length === 0) {
      // Slug collision: another listing already has this id. Nothing was written, so
      // don't sync Sequenzy — the customAttributes would point at someone else's listing.
      return NextResponse.json(
        {
          error:
            'A listing with a matching name already exists. Please contact us if this is unexpected.',
        },
        { status: 409 },
      );
    }

    const newsletterOptIn = result.data.newsletterOptIn !== false;
    await syncSequenzySubscriber({
      email,
      tags: newsletterOptIn
        ? ['submitted-listing', 'newsletter-signup']
        : ['submitted-listing'],
      lists: newsletterOptIn
        ? [PRODUCT_SUBSCRIBERS_LIST_ID, NEWSLETTER_SUBSCRIBERS_LIST_ID]
        : [PRODUCT_SUBSCRIBERS_LIST_ID],
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
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
