import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { servers } from '@/db/schema';
import { getPriceId, PAID_PRODUCTS, type PaidSku } from '@/lib/pricing';
import { getAppUrl, getStripe } from '@/lib/stripe';

export type CreateCheckoutParams = {
  serverId: string;
  sku: PaidSku;
  email?: string;
  coupon?: string;
  env?: any;
};

export type CreateCheckoutResult = {
  success: boolean;
  url?: string;
  sessionId?: string;
  error?: string;
  hint?: string;
  status?: number;
};

export async function createStripeCheckoutSession(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
  let { serverId, sku, email, coupon, env } = params;

  if (!env || !env.DB || !env.STRIPE_SECRET_KEY) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = await getCloudflareContext();
      if (ctx?.env) {
        env = { ...ctx.env, ...env };
      }
    } catch {
      /* fallback */
    }
  }

  const secretKey = env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      success: false,
      status: 503,
      error: 'Stripe is not configured yet.',
      hint: 'Set STRIPE_SECRET_KEY and Price IDs in environment variables, then redeploy.',
    };
  }

  const product = PAID_PRODUCTS[sku];
  if (!product) {
    return {
      success: false,
      status: 400,
      error: `Invalid SKU "${sku}". Valid options: priority_review, featured_7d, premium_monthly`,
    };
  }

  const priceId = getPriceId(sku, env);
  if (!priceId) {
    return {
      success: false,
      status: 503,
      error: `Missing Stripe Price ID for ${product.name}.`,
      hint: `Set ${product.priceEnv} in Cloudflare Dashboard environment secrets.`,
    };
  }

  if (!env?.DB) {
    return { success: false, status: 500, error: 'Database unavailable' };
  }

  const db = drizzle(env.DB);
  const rows = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  const server = rows[0];
  if (!server) {
    return { success: false, status: 404, error: 'Listing not found' };
  }

  if (sku === 'priority_review' && server.status !== 'pending') {
    return {
      success: false,
      status: 400,
      error: 'Priority review is only available for listings still awaiting approval.',
    };
  }

  if ((sku === 'featured_7d' || sku === 'premium_monthly') && server.status !== 'active') {
    return {
      success: false,
      status: 400,
      error: 'Featured and Premium are available after your listing is approved.',
    };
  }

  if (sku === 'premium_monthly' && server.isPremium && server.premiumStatus === 'active') {
    return {
      success: false,
      status: 400,
      error: 'This listing already has an active Premium subscription.',
    };
  }

  const stripe = getStripe(secretKey);
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
    allow_promotion_codes: true,
  };

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

  if (!session?.url) {
    return { success: false, status: 500, error: 'Could not create Checkout session' };
  }

  const finalUrl = coupon
    ? `${session.url}${session.url.includes('?') ? '&' : '?'}prefilled_promo_code=${encodeURIComponent(coupon.trim())}`
    : session.url;

  return {
    success: true,
    url: finalUrl,
    sessionId: session.id,
  };
}
