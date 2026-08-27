import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, count, eq, gte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reports, servers } from '../../../../../db/schema';
import { verifyTurnstileToken } from '../../../../../lib/turnstile';
import {
  getClientIp,
  hashVisitorForServer,
} from '../../../../../lib/upvoteHash';

const REPORT_REASONS = [
  'broken_install',
  'misleading',
  'malicious',
  'dead_link',
  'other',
] as const;

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional().or(z.literal('')),
  'cf-turnstile-response': z.string().optional(),
});

/** Soft rate limits — generous enough not to block one legitimate report, tight enough to block scripted mass-reporting. */
const MAX_REPORTS_PER_HOUR_GLOBAL = 5;
const MAX_REPORTS_PER_DAY_PER_LISTING = 2;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Anonymous "report a problem" flag — Turnstile-gated, no login required (the
 * visitor most motivated to report something is usually mid-frustration with
 * a broken install, so this stays low-friction). Never feeds the public
 * quality score directly — see db/schema.ts's `reports` table comment.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      /* fallback to process.env inside verifyTurnstileToken */
    }

    const body = (await req.json()) as any;

    const turnstileResult = await verifyTurnstileToken(
      body['cf-turnstile-response'],
      env,
      req.headers.get('x-forwarded-for') || '',
    );
    if (!turnstileResult.ok) {
      return NextResponse.json(
        { error: turnstileResult.error },
        { status: turnstileResult.status },
      );
    }

    const result = reportSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }
    const { reason } = result.data;
    const details = result.data.details ? result.data.details.trim() : null;

    if (!env?.DB) {
      return NextResponse.json(
        { error: 'Database binding not found' },
        { status: 500 },
      );
    }
    const db = drizzle(env.DB as any);

    const [server] = await db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.id, id))
      .limit(1);
    if (!server) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Fixed 'report' scope (not the listing id) so the hash rate-limits total
    // report velocity from one IP across the whole catalog, not just per-listing.
    const ip = getClientIp(req);
    const ipHash = await hashVisitorForServer(ip, 'report');

    if (ipHash) {
      const now = Date.now();
      const [hourly, perListingDaily] = await Promise.all([
        db
          .select({ n: count() })
          .from(reports)
          .where(
            and(
              eq(reports.reporterIpHash, ipHash),
              gte(reports.createdAt, new Date(now - HOUR_MS)),
            ),
          ),
        db
          .select({ n: count() })
          .from(reports)
          .where(
            and(
              eq(reports.reporterIpHash, ipHash),
              eq(reports.serverId, id),
              gte(reports.createdAt, new Date(now - DAY_MS)),
            ),
          ),
      ]);

      if ((hourly[0]?.n ?? 0) >= MAX_REPORTS_PER_HOUR_GLOBAL) {
        return NextResponse.json(
          {
            error:
              'Too many reports from this connection recently. Please try again later.',
          },
          { status: 429 },
        );
      }
      if ((perListingDaily[0]?.n ?? 0) >= MAX_REPORTS_PER_DAY_PER_LISTING) {
        return NextResponse.json(
          {
            error:
              "You've already reported this listing recently — our team will take a look.",
          },
          { status: 429 },
        );
      }
    }

    await db.insert(reports).values({
      serverId: id,
      reason,
      details,
      reporterIpHash: ipHash,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Report submission error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
