/**
 * AllMCPs paid products — amounts for UI; Stripe Price IDs from env.
 * Catalog: one Product per plan (Stripe best practice).
 */

export type PaidSku = 'priority_review' | 'featured_7d' | 'premium_monthly';

export type PaidProduct = {
  sku: PaidSku;
  name: string;
  tagline: string;
  /** Display price in USD cents */
  unitAmount: number;
  interval: 'one_time' | 'month';
  mode: 'payment' | 'subscription';
  /** Env var name holding Stripe Price ID */
  priceEnv: string;
  benefits: string[];
};

/**
 * The free submission tier. Not a Stripe product — kept separate from
 * PAID_PRODUCTS so checkout/iteration logic never treats it as payable.
 * Surfaced on the pricing page and agent guidance for comparison.
 */
export type FreeTier = {
  sku: 'free_listing';
  name: string;
  tagline: string;
  /** Display price in USD cents (always 0) */
  unitAmount: 0;
  interval: 'one_time';
  benefits: string[];
};

export const FREE_TIER: FreeTier = {
  sku: 'free_listing',
  name: 'Free listing',
  tagline: 'List your MCP at no cost',
  unitAmount: 0,
  interval: 'one_time',
  benefits: [
    'Permanent directory listing — free forever',
    'Included in search, categories & agent APIs',
    'Claim ownership via GitHub, site badge, or DNS',
    'Nofollow website backlink',
    'Standard review queue',
  ],
};

export const PAID_PRODUCTS: Record<PaidSku, PaidProduct> = {
  priority_review: {
    sku: 'priority_review',
    name: 'Priority review',
    tagline: 'Jump the submission queue',
    unitAmount: 500,
    interval: 'one_time',
    mode: 'payment',
    priceEnv: 'STRIPE_PRICE_PRIORITY_REVIEW',
    benefits: [
      'Faster manual review of new submissions',
      'Same safety checks — not a paid pass',
      'Ideal when you need to go live soon',
    ],
  },
  featured_7d: {
    sku: 'featured_7d',
    name: 'Featured boost',
    tagline: '7 days in the spotlight',
    unitAmount: 1200,
    interval: 'one_time',
    mode: 'payment',
    priceEnv: 'STRIPE_PRICE_FEATURED_7D',
    benefits: [
      '★ Featured badge in browse list & grid',
      'Higher weight in homepage discovery',
      'Expires automatically after 7 days',
    ],
  },
  premium_monthly: {
    sku: 'premium_monthly',
    name: 'Premium',
    tagline: 'Ongoing featured placement',
    unitAmount: 1900,
    interval: 'month',
    mode: 'subscription',
    priceEnv: 'STRIPE_PRICE_PREMIUM_MONTHLY',
    benefits: [
      'Guaranteed featured rotation on homepage',
      'Rich analytics: see which LLMs & agents use your MCP',
      'Impression tracking across all directory surfaces',
      'Search discovery insights (what queries find you)',
      'Dofollow website backlink (SEO boost)',
      'Verified / Premium badge & glowing card',
      'Priority support & listing edits',
    ],
  },
};

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function getPriceId(sku: PaidSku, envCtx?: any): string | null {
  const envName = PAID_PRODUCTS[sku].priceEnv;
  let value = (envCtx && envCtx[envName]) || process.env[envName];
  if (!value || typeof value !== 'string') return null;
  value = value.trim();
  while (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value.startsWith('price_') ? value : null;
}

export function isStripeConfigured(envCtx?: any): boolean {
  let key = (envCtx && envCtx.STRIPE_SECRET_KEY) || process.env.STRIPE_SECRET_KEY;
  if (!key || typeof key !== 'string') return false;
  key = key.trim();
  return key.startsWith('sk_') || key.startsWith('rk_');
}
