import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { sponsorAds } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthorizedAdminEmail } from '@/lib/adminAuth';
import { sendNotificationEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const adAdminActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum([
    'approve',
    'reject',
    'pause',
    'resume',
    'add_impressions',
    'update_bid',
    'edit',
    'delete',
  ]),
  reason: z.string().trim().optional(),
  bonusImpressions: z.number().int().positive().optional(),
  bidCpm: z.number().int().positive().optional(),
  fields: z
    .object({
      title: z.string().trim().min(1).max(100).optional(),
      description: z.string().trim().min(1).max(300).optional(),
      ctaText: z.string().trim().min(1).max(50).optional(),
      targetUrl: z.string().trim().url().optional(),
      logoUrl: z.string().trim().url().optional(),
      placement: z.enum(['all', 'directory_inline', 'detail_sidebar', 'blog_guide', 'header_banner']).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const adminEmail = await getAuthorizedAdminEmail();
    if (!adminEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = adAdminActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.format() }, { status: 400 });
    }

    const { id, action, reason, bonusImpressions, bidCpm, fields } = parsed.data;

    const ctx = await getCloudflareContext();
    if (!ctx?.env?.DB) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const db = drizzle(ctx.env.DB);

    switch (action) {
      case 'approve': {
        const [adToApprove] = await db
          .select({
            stripePaymentIntentId: sponsorAds.stripePaymentIntentId,
            advertiserEmail: sponsorAds.advertiserEmail,
            title: sponsorAds.title,
          })
          .from(sponsorAds)
          .where(eq(sponsorAds.id, id))
          .limit(1);

        if (!adToApprove?.stripePaymentIntentId) {
          return NextResponse.json(
            { error: 'Cannot approve: payment is not yet confirmed for this campaign.' },
            { status: 409 }
          );
        }

        await db
          .update(sponsorAds)
          .set({
            status: 'active',
            approvedAt: new Date(),
            rejectionReason: null,
          })
          .where(eq(sponsorAds.id, id));

        try {
          await sendNotificationEmail({
            to: adToApprove.advertiserEmail,
            heading: 'Your sponsor campaign is live',
            message: `Your campaign "${adToApprove.title}" has been approved and is now running across AllMCPs.`,
            actionText: 'View campaign dashboard',
            actionUrl: `${getAppUrl()}/advertise/campaign/${id}`,
          });
        } catch (emailErr) {
          console.error('[admin/ads/action] approval email failed:', emailErr);
        }
        break;
      }

      case 'reject': {
        const [existingAd] = await db
          .select()
          .from(sponsorAds)
          .where(eq(sponsorAds.id, id))
          .limit(1);

        // If paid via Stripe, automatically issue 100% full refund
        if (existingAd?.stripePaymentIntentId && (ctx.env as any)?.STRIPE_SECRET_KEY) {
          try {
            const { getStripe } = await import('@/lib/stripe');
            const stripe = getStripe((ctx.env as any).STRIPE_SECRET_KEY);
            await stripe.refunds.create({
              payment_intent: existingAd.stripePaymentIntentId,
            });
            console.log(`[admin/ads] Issued 100% refund for ad ${id} (PI: ${existingAd.stripePaymentIntentId})`);
          } catch (refundErr: any) {
            console.error('[admin/ads] Stripe refund error:', refundErr?.message);
          }
        }

        const finalRejectionReason = reason || 'Does not meet sponsorship guidelines';

        await db
          .update(sponsorAds)
          .set({
            status: 'rejected',
            rejectionReason: finalRejectionReason,
          })
          .where(eq(sponsorAds.id, id));

        if (existingAd?.advertiserEmail) {
          try {
            await sendNotificationEmail({
              to: existingAd.advertiserEmail,
              heading: 'Your sponsor campaign was not approved',
              message: existingAd.stripePaymentIntentId
                ? `Your campaign "${existingAd.title}" was not approved: ${finalRejectionReason}. A full refund has been issued to your original payment method.`
                : `Your campaign "${existingAd.title}" was not approved: ${finalRejectionReason}.`,
              actionText: 'Submit a new campaign',
              actionUrl: `${getAppUrl()}/advertise/create`,
            });
          } catch (emailErr) {
            console.error('[admin/ads/action] rejection email failed:', emailErr);
          }
        }
        break;
      }

      case 'pause': {
        const [adToPause] = await db
          .select({ advertiserEmail: sponsorAds.advertiserEmail, title: sponsorAds.title })
          .from(sponsorAds)
          .where(eq(sponsorAds.id, id))
          .limit(1);

        await db
          .update(sponsorAds)
          .set({ status: 'paused' })
          .where(eq(sponsorAds.id, id));

        if (adToPause?.advertiserEmail) {
          try {
            await sendNotificationEmail({
              to: adToPause.advertiserEmail,
              heading: 'Your sponsor campaign has been paused',
              message: reason
                ? `Your campaign "${adToPause.title}" has been paused: ${reason}. Delivery has stopped and will resume once this is resolved.`
                : `Your campaign "${adToPause.title}" has been paused by AllMCPs staff. Delivery has stopped for now — contact us if you have questions.`,
              actionText: 'View campaign dashboard',
              actionUrl: `${getAppUrl()}/advertise/campaign/${id}`,
            });
          } catch (emailErr) {
            console.error('[admin/ads/action] pause email failed:', emailErr);
          }
        }
        break;
      }

      case 'resume': {
        const [adToResume] = await db
          .select({ advertiserEmail: sponsorAds.advertiserEmail, title: sponsorAds.title })
          .from(sponsorAds)
          .where(eq(sponsorAds.id, id))
          .limit(1);

        await db
          .update(sponsorAds)
          .set({ status: 'active' })
          .where(eq(sponsorAds.id, id));

        if (adToResume?.advertiserEmail) {
          try {
            await sendNotificationEmail({
              to: adToResume.advertiserEmail,
              heading: 'Your sponsor campaign has resumed',
              message: `Your campaign "${adToResume.title}" is active again and delivering across AllMCPs.`,
              actionText: 'View campaign dashboard',
              actionUrl: `${getAppUrl()}/advertise/campaign/${id}`,
            });
          } catch (emailErr) {
            console.error('[admin/ads/action] resume email failed:', emailErr);
          }
        }
        break;
      }

      case 'add_impressions': {
        if (bonusImpressions) {
          const [adToBonus] = await db
            .select({
              status: sponsorAds.status,
              stripePaymentIntentId: sponsorAds.stripePaymentIntentId,
              advertiserEmail: sponsorAds.advertiserEmail,
              title: sponsorAds.title,
              totalImpressionsPurchased: sponsorAds.totalImpressionsPurchased,
            })
            .from(sponsorAds)
            .where(eq(sponsorAds.id, id))
            .limit(1);

          // Bonus impressions reactivate the campaign, so this must never fire
          // on an ad that hasn't cleared the same payment gate `approve` enforces
          // (still pending_approval / unpaid) or one that was rejected & refunded.
          if (!adToBonus?.stripePaymentIntentId || adToBonus.status === 'pending_approval' || adToBonus.status === 'rejected') {
            return NextResponse.json(
              { error: 'Cannot add impressions: this campaign was never an approved, paid campaign.' },
              { status: 409 }
            );
          }

          await db
            .update(sponsorAds)
            .set({
              totalImpressionsPurchased: sql`${sponsorAds.totalImpressionsPurchased} + ${bonusImpressions}`,
              status: 'active',
            })
            .where(eq(sponsorAds.id, id));

          try {
            await sendNotificationEmail({
              to: adToBonus.advertiserEmail,
              heading: 'Bonus impressions added to your campaign',
              message: `We've added ${bonusImpressions.toLocaleString()} bonus impressions to your campaign "${adToBonus.title}" — new total: ${(adToBonus.totalImpressionsPurchased + bonusImpressions).toLocaleString()}. It's running again if it had finished delivering.`,
              actionText: 'View campaign dashboard',
              actionUrl: `${getAppUrl()}/advertise/campaign/${id}`,
            });
          } catch (emailErr) {
            console.error('[admin/ads/action] bonus impressions email failed:', emailErr);
          }
        }
        break;
      }

      case 'update_bid':
        if (bidCpm) {
          await db
            .update(sponsorAds)
            .set({ bidCpm })
            .where(eq(sponsorAds.id, id));
        }
        break;

      case 'edit':
        if (fields) {
          await db
            .update(sponsorAds)
            .set({
              ...(fields.title ? { title: fields.title } : {}),
              ...(fields.description ? { description: fields.description } : {}),
              ...(fields.ctaText ? { ctaText: fields.ctaText } : {}),
              ...(fields.targetUrl ? { targetUrl: fields.targetUrl } : {}),
              ...(fields.logoUrl ? { logoUrl: fields.logoUrl } : {}),
              ...(fields.placement ? { placement: fields.placement } : {}),
            })
            .where(eq(sponsorAds.id, id));
        }
        break;

      case 'delete': {
        const [adToDelete] = await db
          .select({ status: sponsorAds.status, stripePaymentIntentId: sponsorAds.stripePaymentIntentId })
          .from(sponsorAds)
          .where(eq(sponsorAds.id, id))
          .limit(1);

        // A paid campaign that's still running (or paused mid-run) hasn't been
        // refunded — deleting it here would erase the ad with no refund and no
        // advertiser notice. Route those through `reject` instead, which refunds
        // and emails the advertiser before the row is safe to delete.
        if (adToDelete?.stripePaymentIntentId && (adToDelete.status === 'active' || adToDelete.status === 'paused')) {
          return NextResponse.json(
            { error: 'This campaign is paid and still active/paused. Reject it first to issue a refund, then delete.' },
            { status: 409 }
          );
        }

        await db.delete(sponsorAds).where(eq(sponsorAds.id, id));
        break;
      }
    }

    return NextResponse.json({ success: true, action, id });
  } catch (err: any) {
    console.error('[admin/ads/action] error:', err?.message);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
