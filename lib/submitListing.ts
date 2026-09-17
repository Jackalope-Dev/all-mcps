import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { servers } from '../db/schema';
import { prepareListingIntake } from './listingIntake';
import { getEmailEnv, sendNotificationEmail } from './notify';
import { checkRateLimit, rateLimitHeaders } from './rateLimit';
import {
  PRODUCT_SUBSCRIBERS_LIST_ID,
  syncSequenzySubscriber,
} from './sequenzy';
import { getAppUrl } from './stripe';
import { formatZodError } from './zodError';

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
  remoteEndpointUrl: z.string().optional().or(z.literal('')),
  suggestedInstallCommand: z.string().optional(),
  suggestedInstallArgs: z.array(z.string()).optional(),
});

export type SubmitListingSuccess = {
  success: true;
  message: string;
  id: string;
  name: string;
  url: string;
  category: string;
  status: 'pending';
  claim_url: string;
  badge_markdown: string;
};

export type SubmitListingOutcome =
  | { ok: true; status: 200; body: SubmitListingSuccess }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
      headers?: Record<string, string>;
    };

/**
 * Core "agent submission" logic, shared by the public `/api/v1/submit` HTTP
 * route and the `submit_mcp_server` MCP tool. Framework-agnostic (takes a
 * plain object + a caller-supplied rate-limit key, returns a plain outcome)
 * so it can be called in-process from either entry point — a same-zone
 * `fetch()` from inside a Worker back to its own `/api/v1/submit` route is
 * not reliable (see app/api/mcp/route.ts), so the MCP tool must call this
 * directly rather than round-tripping over HTTP.
 */
export async function submitListing(
  rawBody: unknown,
  rateLimitKey: string,
): Promise<SubmitListingOutcome> {
  // No CAPTCHA on this path (unlike the human /submit form) — the one guard
  // against automated spam submissions is a tight per-IP rate limit.
  const rateLimit = checkRateLimit(`v1_submit:${rateLimitKey}`, 5, 3600);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'rate_limited',
        message: `Too many requests. Retry after ${rateLimit.resetSeconds}s.`,
        docs: 'https://allmcps.com/docs/api',
      },
      headers: {
        ...rateLimitHeaders(rateLimit),
        'Retry-After': String(rateLimit.resetSeconds),
      },
    };
  }

  const result = agentSubmitSchema.safeParse(rawBody);
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Invalid submission data',
        details: formatZodError(result.error),
      },
    };
  }

  let env: any;
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch {
    return { ok: false, status: 500, body: { error: 'Database unavailable' } };
  }
  if (!env?.DB) {
    return {
      ok: false,
      status: 500,
      body: { error: 'Database binding not found' },
    };
  }
  const db = drizzle(env.DB as any);

  const prepared = await prepareListingIntake(result.data, db, env);
  if (!prepared.ok) {
    return { ok: false, status: prepared.status, body: prepared.body };
  }
  const { id, name, url, category } = prepared;
  const email = result.data.email.trim().toLowerCase();

  const insertResult = await db
    .insert(servers)
    .values(prepared.values as any)
    .onConflictDoNothing()
    .returning({ id: servers.id });

  if (insertResult.length === 0) {
    return {
      ok: false,
      status: 409,
      body: { error: `Listing for "${name}" already exists on AllMCPs.` },
    };
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

  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      message: `Server "${name}" submitted successfully via Agent API!`,
      id,
      name,
      url,
      category,
      status: 'pending',
      claim_url: claimUrl,
      badge_markdown: badgeMarkdown,
    },
  };
}
