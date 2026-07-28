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

export function getPriceId(sku: PaidSku): string | null {
  const envName = PAID_PRODUCTS[sku].priceEnv;
  const value = process.env[envName];
  return value && value.startsWith('price_') ? value : null;
}

export function isStripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_'));
}
