import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { servers, sponsorAds } from '../../../../db/schema';
import { formatUsdAmount } from '../../../../lib/ads';
import { attributionFromStripeMetadata } from '../../../../lib/attribution';
import { fulfillBoostPurchase } from '../../../../lib/boostPurchase';
import { recordConversion } from '../../../../lib/conversions';
import { sendReceiptEmail } from '../../../../lib/notify';
import type { PaidSku } from '../../../../lib/pricing';
import { getAppUrl, getStripe } from '../../../../lib/stripe';

async function getDb() {
  const ctx = await getCloudflareContext();
  const env = ctx.env as any;
  if (!env?.DB) throw new Error('DB missing');
  return drizzle(env.DB);
}

async function applyCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
) {
  // Handle Sponsor Ad Campaign Purchases
  if (session.metadata?.adId) {
    const adId = session.metadata.adId;
    const db = await getDb();
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || null;

    // invoice_creation was enabled on the ad checkout session (see
    // app/api/ads/create/route.ts and app/advertise/resume/[id]/route.ts) so
    // advertisers have a real downloadable invoice, not just a dashboard summary.
    const invoiceId =
      typeof session.invoice === 'string'
        ? session.invoice
        : session.invoice?.id || null;
    let invoiceUrl: string | null = null;
    if (invoiceId) {
      try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        invoiceUrl = invoice.hosted_invoice_url || null;
      } catch (err) {
        console.error(
          `Failed to retrieve invoice ${invoiceId} for ad ${adId}:`,
          err,
        );
      }
    }

    await db
      .update(sponsorAds)
      .set({
        amountPaidCents: session.amount_total || undefined,
        stripePaymentIntentId: paymentIntentId,
        ...(invoiceUrl ? { stripeInvoiceUrl: invoiceUrl } : {}),
      })
      .where(eq(sponsorAds.id, adId));

    await recordConversion(db, {
      kind: 'ad_purchase',
      adId,
      sku: 'sponsor_ad',
      amountCents: session.amount_total,
      attribution: attributionFromStripeMetadata(session.metadata),
      stripeSessionId: session.id,
    });

    console.log(
      `[stripe webhook] Sponsor ad ${adId} payment verified: $${((session.amount_total || 0) / 100).toFixed(2)}`,
    );

    // Advertisers otherwise get nothing confirming payment succeeded until an
    // admin approves or rejects the campaign — the abandoned-checkout reminder
    // only ever targets *unpaid* ads, so a paid-but-pending-review advertiser
    // was previously invisible to the email system.
    const [adForReceipt] = await db
      .select({ title: sponsorAds.title })
      .from(sponsorAds)
      .where(eq(sponsorAds.id, adId))
      .limit(1);
    const advertiserEmail =
      session.metadata?.advertiserEmail || session.customer_details?.email;
    if (advertiserEmail) {
      try {
        await sendReceiptEmail({
          to: advertiserEmail,
          receiptId: paymentIntentId || session.id,
          date: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          amount: formatUsdAmount(session.amount_total || 0),
          description: `AllMCPs Sponsor Campaign: ${adForReceipt?.title || 'Ad Campaign'}`,
          actionText: 'View campaign dashboard',
          actionUrl: `${getAppUrl()}/advertise/campaign/${adId}`,
        });
      } catch (emailErr) {
        console.error('[stripe webhook] receipt email failed:', emailErr);
      }
    }
    return;
  }

  const serverId = session.metadata?.serverId || session.client_reference_id;
  const sku = (session.metadata?.sku || '') as PaidSku;
  if (!serverId || !sku) {
    console.warn('Checkout session missing serverId/sku metadata', session.id);
    return;
  }

  // Weekly SKUs are sold in blocks priced via price_data (see
  // createStripeCheckoutSession) — quantity IS weeks. Re-read it from the
  // line item rather than trusting session.metadata.
  let weeks = 1;
  if (sku === 'featured_7d' || sku === 'category_sponsor_7d') {
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id,
        { limit: 1 },
      );
      weeks = lineItems.data[0]?.quantity || 1;
    } catch (err) {
      console.error(
        `Failed to read line item quantity for session ${session.id}, defaulting to 1 week:`,
        err,
      );
    }
  }

  await fulfillBoostPurchase(await getDb(), {
    serverId,
    sku,
    weeks,
    amountCents: session.amount_total,
    attribution: attributionFromStripeMetadata(session.metadata),
    paymentRef: session.id,
    email: session.customer_details?.email || null,
    stripeCustomerId:
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id || null,
    stripeSubscriptionId:
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id || null,
  });
}

async function applySubscriptionUpdated(sub: Stripe.Subscription) {
  const db = await getDb();
  let serverId = sub.metadata?.serverId;

  if (!serverId) {
    const subId = sub.id;
    const custId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

    let matched = await db
      .select()
      .from(servers)
      .where(eq(servers.stripeSubscriptionId, subId))
      .limit(1);
    if (!matched.length && custId) {
      matched = await db
        .select()
        .from(servers)
        .where(eq(servers.stripeCustomerId, custId))
        .limit(1);
    }
    if (matched.length > 0) {
      serverId = matched[0].id;
    }
  }

  if (!serverId) {
    console.warn(
      `Subscription updated event ${sub.id} missing serverId metadata and no DB match found`,
    );
    return;
  }

  const active = sub.status === 'active' || sub.status === 'trialing';
  const pastDue = sub.status === 'past_due';

  await db
    .update(servers)
    .set({
      isPremium: active,
      premiumStatus: active
        ? 'active'
        : pastDue
          ? 'past_due'
          : sub.status === 'canceled'
            ? 'canceled'
            : sub.status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId:
        typeof sub.customer === 'string'
          ? sub.customer
          : sub.customer?.id || undefined,
    })
    .where(eq(servers.id, serverId));
}

async function applySubscriptionDeleted(sub: Stripe.Subscription) {
  const db = await getDb();
  let serverId = sub.metadata?.serverId;

  if (!serverId) {
    const matched = await db
      .select()
      .from(servers)
      .where(eq(servers.stripeSubscriptionId, sub.id))
      .limit(1);
    if (matched.length > 0) {
      serverId = matched[0].id;
    }
  }

  if (!serverId) {
    console.warn(
      `Subscription deleted event ${sub.id} missing serverId metadata and no DB match found`,
    );
    return;
  }

  await db
    .update(servers)
    .set({
      isPremium: false,
      premiumStatus: 'canceled',
      stripeSubscriptionId: sub.id,
    })
    .where(eq(servers.id, serverId));
}

export async function POST(req: Request) {
  let env: any;
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch {
    /* fallback */
  }

  const secretKey = env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  const webhookSecret =
    env?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe(secretKey);

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET missing');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 },
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await applyCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          stripe,
        );
        break;
      case 'customer.subscription.updated':
        await applySubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await applySubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        break;
    }
  } catch (e) {
    console.error('Stripe webhook handler error:', e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
