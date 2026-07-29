import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { servers } from '../../../../db/schema';
import { getPriceId, PAID_PRODUCTS, type PaidSku } from '../../../../lib/pricing';
import { getAppUrl, getStripe } from '../../../../lib/stripe';

const bodySchema = z.object({
  serverId: z.string().min(1),
  sku: z.enum(['priority_review', 'featured_7d', 'premium_monthly']),
  email: z.string().email().optional(),
  coupon: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        {
          error: 'Stripe is not configured yet.',
          hint: 'Set STRIPE_SECRET_KEY and price IDs, then redeploy.',
        },
        { status: 503 }
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { serverId, sku, email, coupon } = parsed.data;
    const product = PAID_PRODUCTS[sku as PaidSku];
    const priceId = getPriceId(sku as PaidSku);

    if (!priceId) {
      return NextResponse.json(
        {
          error: `Missing Stripe Price ID for ${product.name}.`,
          hint: `Set ${product.priceEnv} to a price_… id from the Stripe Dashboard.`,
        },
        { status: 503 }
      );
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const db = drizzle(env.DB);
    const rows = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    const server = rows[0];
    if (!server) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (sku === 'priority_review' && server.status !== 'pending') {
      return NextResponse.json(
        { error: 'Priority review is only available for listings still awaiting approval.' },
        { status: 400 }
      );
    }

    if ((sku === 'featured_7d' || sku === 'premium_monthly') && server.status !== 'active') {
      return NextResponse.json(
        { error: 'Featured and Premium are available after your listing is approved.' },
        { status: 400 }
      );
    }

    if (sku === 'premium_monthly' && server.isPremium && server.premiumStatus === 'active') {
      return NextResponse.json(
        { error: 'This listing already has an active Premium subscription.' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();
    const successPath =
      sku === 'priority_review'
        ? `/submit?paid=priority&id=${encodeURIComponent(serverId)}`
        : `/mcp/${encodeURIComponent(serverId)}?paid=${encodeURIComponent(sku)}`;

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: product.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}${successPath}`,
      cancel_url: `${appUrl}/pricing?serverId=${encodeURIComponent(serverId)}&canceled=1`,
      metadata: {
        serverId,
        sku,
      },
      client_reference_id: serverId,
    };

    if (coupon) {
      sessionParams.discounts = [{ coupon }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    if (email) {
      sessionParams.customer_email = email;
    } else if (server.stripeCustomerId) {
      sessionParams.customer = server.stripeCustomerId;
    }

    if (product.mode === 'subscription') {
      sessionParams.subscription_data = {
        metadata: { serverId, sku },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json({ error: 'Could not create Checkout session' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (e: any) {
    console.error('Stripe checkout error:', e);
    return NextResponse.json({ error: 'Checkout failed', details: e?.message }, { status: 500 });
  }
}
