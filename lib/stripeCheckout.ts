import { drizzle } from 'drizzle-orm/d1';
import { eq, and, ne, gt } from 'drizzle-orm';
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

function appendPrefilledPromoCode(url: string, code: string): string {
  const cleanCode = code.trim();
  if (!cleanCode) return url;
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    const base = url.substring(0, hashIndex);
    const hash = url.substring(hashIndex);
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}prefilled_promo_code=${encodeURIComponent(cleanCode)}${hash}`;
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}prefilled_promo_code=${encodeURIComponent(cleanCode)}`;
}

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

  if (
    (sku === 'featured_7d' || sku === 'category_sponsor_7d' || sku === 'premium_monthly') &&
    server.status !== 'active'
  ) {
    return {
      success: false,
      status: 400,
      error: 'Featured, Category Sponsor, and Premium are available after your listing is approved.',
    };
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
      error: `Invalid SKU "${sku}". Valid options: priority_review, featured_7d, category_sponsor_7d, premium_monthly`,
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

  if (sku === 'premium_monthly' && server.isPremium && server.premiumStatus === 'active') {
    return {
      success: false,
      status: 400,
      error: 'This listing already has an active Premium subscription.',
    };
  }

  if (sku === 'category_sponsor_7d') {
    const now = new Date();
    const existingSponsor = await db
      .select({ id: servers.id, name: servers.name, categorySponsorUntil: servers.categorySponsorUntil })
      .from(servers)
      .where(
        and(
          eq(servers.category, server.category),
          ne(servers.id, server.id),
          gt(servers.categorySponsorUntil, now)
        )
      )
      .limit(1);

    if (existingSponsor.length > 0) {
      const until = existingSponsor[0].categorySponsorUntil
        ? new Date(existingSponsor[0].categorySponsorUntil).toLocaleDateString()
        : 'soon';
      return {
        success: false,
        status: 409,
        error: `"${server.category}" is already sponsored by another listing until ${until}. Only one category sponsor runs at a time — check back after it expires.`,
      };
    }
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
  } else if (product.mode === 'payment') {
    sessionParams.invoice_creation = { enabled: true };
  }

  let promoFound = false;
  if (coupon && coupon.trim()) {
    const cleanCoupon = coupon.trim();
    try {
      const promoList = await stripe.promotionCodes.list({
        code: cleanCoupon,
        active: true,
        limit: 1,
      });

      if (promoList.data && promoList.data.length > 0) {
        sessionParams.discounts = [{ promotion_code: promoList.data[0].id }];
        sessionParams.allow_promotion_codes = undefined;
        promoFound = true;
      }
    } catch {
      /* fallback to prefilled_promo_code parameter */
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session?.url) {
    return { success: false, status: 500, error: 'Could not create Checkout session' };
  }

  const finalUrl = coupon && !promoFound ? appendPrefilledPromoCode(session.url, coupon) : session.url;

  return {
    success: true,
    url: finalUrl,
    sessionId: session.id,
  };
}
