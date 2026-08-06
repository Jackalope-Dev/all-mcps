/**
 * AllMCPs paid products — amounts for UI; Stripe Price IDs from env.
 * Catalog: one Product per plan (Stripe best practice).
 */

export type PaidSku = 'priority_review' | 'featured_7d' | 'category_sponsor_7d' | 'premium_monthly';

/** One volume-pricing tier: weeks <= upToWeeks (or unbounded if null) are billed at unitAmount/week. */
export type WeeklyTier = { upToWeeks: number | null; unitAmount: number };

export type PaidProduct = {
  sku: PaidSku;
  name: string;
  tagline: string;
  /** Display price in USD cents (1-week rate for weekly-tiered products) */
  unitAmount: number;
  interval: 'one_time' | 'month';
  mode: 'payment' | 'subscription';
  /** Env var name holding Stripe Price ID */
  priceEnv: string;
  benefits: string[];
  badgeText?: string;
  placementHint?: string;
  targetAudience?: string;
  /**
   * Present only for products sold in multi-week blocks (featured_7d, category_sponsor_7d).
   * The Stripe Price behind priceEnv must be a `billing_scheme: 'tiered'`, `tiers_mode: 'volume'`
   * price whose tiers match this table exactly — this is the client-side mirror used to preview
   * totals before checkout. maxWeeks is enforced both here and as Checkout's adjustable_quantity cap.
   */
  weeklyTiers?: WeeklyTier[];
  maxWeeks?: number;
};

/** Per-week unit price at a given quantity, per the product's volume tiers (flat unitAmount if untiered). */
export function tieredUnitPrice(product: PaidProduct, weeks: number): number {
  if (!product.weeklyTiers || product.weeklyTiers.length === 0) return product.unitAmount;
  const tier =
    product.weeklyTiers.find((t) => t.upToWeeks !== null && weeks <= t.upToWeeks) ??
    product.weeklyTiers[product.weeklyTiers.length - 1];
  return tier.unitAmount;
}

/** Total cents for buying `weeks` of a tiered product (Stripe volume tiering: all units at the reached tier's rate). */
export function tieredTotal(product: PaidProduct, weeks: number): number {
  return tieredUnitPrice(product, weeks) * weeks;
}

/** % saved per week at this quantity vs. the 1-week rate, rounded to the nearest whole percent (0 if no discount). */
export function tieredSavingsPct(product: PaidProduct, weeks: number): number {
  if (!product.weeklyTiers) return 0;
  const base = product.weeklyTiers[0]?.unitAmount ?? product.unitAmount;
  const current = tieredUnitPrice(product, weeks);
  if (base <= 0) return 0;
  return Math.round((1 - current / base) * 100);
}

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
  placementHint?: string;
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
  placementHint: 'Standard directory placement across search & categories.',
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
    badgeText: '⚡ Fast Track',
    placementHint: 'Reviewed and published within 24 hours.',
    targetAudience: 'New submissions launching soon',
    benefits: [
      'Reviewed within 24 hours (guaranteed turnaround)',
      'Direct notification when published live',
      'Ideal for product launches, hackathons & releases',
      'Same security checks — published safely',
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
    badgeText: '★ Popular Boost',
    placementHint: 'Homepage discovery marquee & directory grid cards.',
    targetAudience: 'Active MCPs wanting a sudden surge of developer traffic',
    benefits: [
      '★ Featured badge in browse grid & search results',
      'Higher ranking weight across homepage discovery',
      'Glowing card border highlighting your listing',
      'Runs for as many weeks as you buy',
    ],
    weeklyTiers: [
      { upToWeeks: 1, unitAmount: 1200 },
      { upToWeeks: 3, unitAmount: 1080 },
      { upToWeeks: null, unitAmount: 900 },
    ],
    maxWeeks: 8,
  },
  category_sponsor_7d: {
    sku: 'category_sponsor_7d',
    name: 'Category sponsor',
    tagline: 'Top-of-category sponsorship',
    unitAmount: 1800,
    interval: 'one_time',
    mode: 'payment',
    priceEnv: 'STRIPE_PRICE_CATEGORY_SPONSOR_7D',
    badgeText: '👑 Niche Leader',
    placementHint: 'Pinned #1 spot on your specific category page.',
    targetAudience: 'Tools aiming to capture high-intent category visitors',
    benefits: [
      '★ Pinned #1 spot in your category, for as many weeks as you buy',
      'Crown & Category Sponsor banner on category page',
      'Top exposure to users searching specifically for your niche',
    ],
    weeklyTiers: [
      { upToWeeks: 1, unitAmount: 1800 },
      { upToWeeks: 3, unitAmount: 1620 },
      { upToWeeks: null, unitAmount: 1350 },
    ],
    maxWeeks: 8,
  },
  premium_monthly: {
    sku: 'premium_monthly',
    name: 'Premium',
    tagline: 'Ongoing featured placement & analytics',
    unitAmount: 1900,
    interval: 'month',
    mode: 'subscription',
    priceEnv: 'STRIPE_PRICE_PREMIUM_MONTHLY',
    badgeText: '💎 Best Value',
    placementHint: 'Homepage rotation, category highlights & agent API priority.',
    targetAudience: 'Growth-stage MCPs, SaaS tools & companies seeking continuous reach',
    benefits: [
      'Guaranteed featured rotation on homepage & browse',
      'Rich analytics: see which LLMs & agents access your server',
      'Dofollow website backlink (valuable SEO boost)',
      'Verified / Premium badge & glowing card design',
      'Impression tracking & search discovery insights',
      'Priority support & instant listing edits',
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
