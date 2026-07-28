import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { servers } from '../../../../db/schema';
import { getStripe } from '../../../../lib/stripe';
import type { PaidSku } from '../../../../lib/pricing';

async function getDb() {
  const ctx = await getCloudflareContext();
  const env = ctx.env as any;
  if (!env?.DB) throw new Error('DB missing');
  return drizzle(env.DB);
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

async function applyCheckoutCompleted(session: Stripe.Checkout.Session) {
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

  if (sku === 'priority_review') {
    await db
      .update(servers)
      .set({
        reviewPriority: true,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      })
      .where(eq(servers.id, serverId));
    return;
  }

  if (sku === 'featured_7d') {
    const rows = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    const current = rows[0];
    const base =
      current?.featuredUntil && new Date(current.featuredUntil).getTime() > Date.now()
        ? new Date(current.featuredUntil)
        : new Date();
    await db
      .update(servers)
      .set({
        featuredUntil: addDays(base, 7),
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      })
      .where(eq(servers.id, serverId));
    return;
  }

  if (sku === 'premium_monthly') {
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
}

async function applySubscriptionUpdated(sub: Stripe.Subscription) {
  const serverId = sub.metadata?.serverId;
  if (!serverId) return;

  const db = await getDb();
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
  const serverId = sub.metadata?.serverId;
  if (!serverId) return;
  const db = await getDb();
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
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
        await applyCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
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
