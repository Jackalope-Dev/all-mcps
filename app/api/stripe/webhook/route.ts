import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { servers, sponsorAds } from '../../../../db/schema';
import { getStripe } from '../../../../lib/stripe';
import type { PaidSku } from '../../../../lib/pricing';
import { syncSequenzySubscriber } from '../../../../lib/sequenzy';

async function getDb() {
  const ctx = await getCloudflareContext();
  const env = ctx.env as any;
  if (!env?.DB) throw new Error('DB missing');
  return drizzle(env.DB);
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

async function applyCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
  // Handle Sponsor Ad Campaign Purchases
  if (session.metadata?.adId) {
    const adId = session.metadata.adId;
    const db = await getDb();
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || null;

    await db
      .update(sponsorAds)
      .set({
        amountPaidCents: session.amount_total || undefined,
        stripePaymentIntentId: paymentIntentId,
      })
      .where(eq(sponsorAds.id, adId));

    console.log(`[stripe webhook] Sponsor ad ${adId} payment verified: $${((session.amount_total || 0) / 100).toFixed(2)}`);
    return;
  }

  const serverId = session.metadata?.serverId || session.client_reference_id;
  const sku = (session.metadata?.sku || '') as PaidSku;
  if (!serverId || !sku) {
    console.warn('Checkout session missing serverId/sku metadata', session.id);
    return;
  }

  const db = await getDb();
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id || null;

  const rows = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  const current = rows[0];

  if (sku === 'priority_review') {
    await db
      .update(servers)
      .set({
        reviewPriority: true,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      })
      .where(eq(servers.id, serverId));
  } else if (sku === 'featured_7d' || sku === 'category_sponsor_7d') {
    // Both SKUs are sold in weekly blocks priced dynamically via price_data (see
    // createStripeCheckoutSession) — quantity IS weeks. Re-reading it from the line item
    // (rather than trusting session.metadata) keeps this correct even if Stripe's own line
    // item representation ever changes; it's the same value either way today.
    let weeks = 1;
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      weeks = lineItems.data[0]?.quantity || 1;
    } catch (err) {
      console.error(`Failed to read line item quantity for session ${session.id}, defaulting to 1 week:`, err);
    }
    const durationDays = 7 * weeks;

    const base =
      current?.featuredUntil && new Date(current.featuredUntil).getTime() > Date.now()
        ? new Date(current.featuredUntil)
        : new Date();
    // category_sponsor_7d also gets the featured badge/glow (same as featured_7d),
    // plus its own categorySponsorUntil — the field the category page actually pins
    // on. Kept separate so a plain featured_7d purchase never accidentally pins.
    const categorySponsorBase =
      sku === 'category_sponsor_7d' &&
      current?.categorySponsorUntil &&
      new Date(current.categorySponsorUntil).getTime() > Date.now()
        ? new Date(current.categorySponsorUntil)
        : new Date();
    await db
      .update(servers)
      .set({
        featuredUntil: addDays(base, durationDays),
        ...(sku === 'category_sponsor_7d'
          ? { categorySponsorUntil: addDays(categorySponsorBase, durationDays) }
          : {}),
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      })
      .where(eq(servers.id, serverId));
  } else if (sku === 'premium_monthly') {
    await db
      .update(servers)
      .set({
        isPremium: true,
        premiumStatus: 'active',
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      })
      .where(eq(servers.id, serverId));
  }

  const email = session.customer_details?.email || current?.submitterEmail || null;
  if (email) {
    try {
      await syncSequenzySubscriber({
        email,
        tags: [`paid-${sku}`],
      });
    } catch (err) {
      console.error(`Failed to sync Sequenzy subscriber for ${email}:`, err);
    }
  }
}

async function applySubscriptionUpdated(sub: Stripe.Subscription) {
  const db = await getDb();
  let serverId = sub.metadata?.serverId;

  if (!serverId) {
    const subId = sub.id;
    const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

    let matched = await db.select().from(servers).where(eq(servers.stripeSubscriptionId, subId)).limit(1);
    if (!matched.length && custId) {
      matched = await db.select().from(servers).where(eq(servers.stripeCustomerId, custId)).limit(1);
    }
    if (matched.length > 0) {
      serverId = matched[0].id;
    }
  }

  if (!serverId) {
    console.warn(`Subscription updated event ${sub.id} missing serverId metadata and no DB match found`);
    return;
  }

  const active = sub.status === 'active' || sub.status === 'trialing';
  const pastDue = sub.status === 'past_due';

  await db
    .update(servers)
    .set({
      isPremium: active,
      premiumStatus: active ? 'active' : pastDue ? 'past_due' : sub.status === 'canceled' ? 'canceled' : sub.status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || undefined,
    })
    .where(eq(servers.id, serverId));
}

async function applySubscriptionDeleted(sub: Stripe.Subscription) {
  const db = await getDb();
  let serverId = sub.metadata?.serverId;

  if (!serverId) {
    const matched = await db.select().from(servers).where(eq(servers.stripeSubscriptionId, sub.id)).limit(1);
    if (matched.length > 0) {
      serverId = matched[0].id;
    }
  }

  if (!serverId) {
    console.warn(`Subscription deleted event ${sub.id} missing serverId metadata and no DB match found`);
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
  const webhookSecret = env?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe(secretKey);

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET missing');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
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
        await applyCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe);
        break;
      case 'customer.subscription.updated':
        await applySubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await applySubscriptionDeleted(event.data.object as Stripe.Subscription);
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
