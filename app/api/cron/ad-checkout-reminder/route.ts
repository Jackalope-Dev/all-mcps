import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { sponsorAds } from '@/db/schema';
import { isAdminAuthorized } from '@/lib/adminAuth';
import { sendNotificationEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';

const REMINDER_DELAY_MS = 2 * 24 * 60 * 60 * 1000; // 2 days after checkout was started
const BATCH_SIZE = 50;

/**
 * Emails a one-time "complete your purchase" reminder for sponsor campaigns
 * that were created but never paid for. Runs daily (see custom-worker.ts).
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const ctx = await getCloudflareContext();
    if (!ctx?.env?.DB) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 500 },
      );
    }

    const db = drizzle(ctx.env.DB);
    const cutoff = new Date(Date.now() - REMINDER_DELAY_MS);

    const abandoned = await db
      .select({
        id: sponsorAds.id,
        title: sponsorAds.title,
        advertiserEmail: sponsorAds.advertiserEmail,
      })
      .from(sponsorAds)
      .where(
        and(
          eq(sponsorAds.status, 'pending_approval'),
          isNull(sponsorAds.stripePaymentIntentId),
          isNull(sponsorAds.abandonedReminderSentAt),
          lt(sponsorAds.createdAt, cutoff),
        ),
      )
      .limit(BATCH_SIZE);

    const appUrl = getAppUrl();
    let sent = 0;

    for (const ad of abandoned) {
      try {
        await sendNotificationEmail({
          to: ad.advertiserEmail,
          heading: 'Finish setting up your AllMCPs sponsor campaign',
          message: `Your campaign "${ad.title}" is almost ready — complete payment to get it reviewed and live.`,
          actionText: 'Complete purchase',
          actionUrl: `${appUrl}/advertise/resume/${ad.id}`,
        });
      } catch (emailErr) {
        console.error(
          `[cron/ad-checkout-reminder] email failed for ${ad.id}:`,
          emailErr,
        );
      }

      // Mark as sent regardless of delivery outcome — a best-effort, once-only
      // reminder, same pattern as other transactional sends in this codebase.
      await db
        .update(sponsorAds)
        .set({ abandonedReminderSentAt: new Date() })
        .where(eq(sponsorAds.id, ad.id));

      sent++;
    }

    return NextResponse.json({ success: true, remindersSent: sent });
  } catch (err: any) {
    console.error('[cron/ad-checkout-reminder] error:', err?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
