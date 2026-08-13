/**
 * AllMCPs Sponsor Ad Network — Core Engine & Types
 * 
 * Manages universal logo + copy + link advertising spaces across AllMCPs.
 * Supports credit-based 1,000-impression blocks with weighted CPM bidding.
 */

export type AdPlacement = 'all' | 'directory_inline' | 'detail_sidebar' | 'blog_guide' | 'header_banner';

export type AdStatus = 'pending_approval' | 'active' | 'paused' | 'completed' | 'rejected';

export type SponsorAd = {
  id: string;
  advertiserEmail: string;
  advertiserUserId?: string | null;
  title: string;
  description: string;
  ctaText: string;
  targetUrl: string;
  logoUrl: string;
  placement: AdPlacement;
  bidCpm: number; // in cents, e.g. 500 = $5.00 CPM
  totalImpressionsPurchased: number;
  impressionsServed: number;
  clicksCount: number;
  status: AdStatus;
  rejectionReason?: string | null;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeInvoiceUrl?: string | null;
  amountPaidCents: number;
  createdAt: Date | string;
  approvedAt?: Date | string | null;
  completedAt?: Date | string | null;
};

export type PlacementMeta = {
  id: AdPlacement;
  name: string;
  tagline: string;
  description: string;
  aspectRatioHint: string;
  estimatedDailyViews: number;
};

export const AD_PLACEMENTS: Record<AdPlacement, PlacementMeta> = {
  all: {
    id: 'all',
    name: 'All Placements (Max Reach)',
    tagline: 'Runs across directory, sidebars, and guide articles',
    description: 'Rotates your ad automatically across all available spots on the site for maximum reach and fastest delivery.',
    aspectRatioHint: 'Square 1:1 or horizontal logo',
    estimatedDailyViews: 50000,
  },
  directory_inline: {
    id: 'directory_inline',
    name: 'Directory Native Card',
    tagline: 'Inlined natively in the MCP directory grid (every ~12 cards)',
    description: 'Featured directly inside the main catalog and search results. Reaches high-intent developers browsing for tools.',
    aspectRatioHint: 'Square 1:1 logo (64x64 or higher)',
    estimatedDailyViews: 25000,
  },
  detail_sidebar: {
    id: 'detail_sidebar',
    name: 'MCP Listing Sidebar',
    tagline: 'Dedicated sponsor slot on individual MCP detail pages',
    description: 'Prominently shown on individual tool pages next to installation instructions and tool inspector configs.',
    aspectRatioHint: 'Square 1:1 logo (48x48)',
    estimatedDailyViews: 15000,
  },
  blog_guide: {
    id: 'blog_guide',
    name: 'Blog & Guide In-Text Unit',
    tagline: 'Clean horizontal banner inside technical tutorials and guides',
    description: 'High engagement placement embedded directly into long-form guides and tutorials read by engineering leaders.',
    aspectRatioHint: 'Horizontal or square icon',
    estimatedDailyViews: 8000,
  },
  header_banner: {
    id: 'header_banner',
    name: 'Category Page Header Banner',
    tagline: 'Top spotlight banner on targeted category and hub directories',
    description: 'Prominently placed above server listings on topic-specific category hubs (e.g. Developer Tools, Cloud Platforms, Databases).',
    aspectRatioHint: 'Square 1:1 or horizontal logo (44x44)',
    estimatedDailyViews: 20000,
  },
};

/** Recommended CPM Bidding presets (cents per 1k impressions) */
export const CPM_TIERS = [
  {
    id: 'standard',
    label: 'Standard',
    cpmCents: 500, // $5.00 / 1k impressions ($0.005 / imp)
    weightMultiplier: 1.0,
    badge: 'Base Delivery',
    tagline: 'Consistent, steady delivery across all spots',
  },
  {
    id: 'growth',
    label: 'Growth Boost',
    cpmCents: 1000, // $10.00 / 1k impressions ($0.01 / imp)
    weightMultiplier: 2.0,
    badge: '2x Priority',
    tagline: 'Double delivery probability during active traffic hours',
  },
  {
    id: 'blitz',
    label: 'Launch Blitz',
    cpmCents: 2000, // $20.00 / 1k impressions ($0.02 / imp)
    weightMultiplier: 4.0,
    badge: '4x Max Speed',
    tagline: 'Top bidding weight for product launches and hackathons',
  },
] as const;

/** Calculate total cost in cents given impression volume and chosen CPM */
export function calculateAdCostCents(impressions: number, cpmCents: number): number {
  return Math.round((impressions / 1000) * cpmCents);
}

/** Calculate CTR percentage */
export function calculateCtr(clicks: number, impressions: number): number {
  if (!impressions || impressions <= 0) return 0;
  return Number(((clicks / impressions) * 100).toFixed(2));
}

/** Format currency */
export function formatUsdAmount(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * Weighted Random Selection: Picks an active ad based on its bid CPM weight.
 * Higher bid CPM = proportionally higher likelihood of being served.
 */
export function selectWeightedAd<T extends { bidCpm: number; impressionsServed: number; totalImpressionsPurchased: number }>(
  ads: T[]
): T | null {
  const eligible = ads.filter((ad) => ad.impressionsServed < ad.totalImpressionsPurchased);
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];

  const totalWeight = eligible.reduce((sum, ad) => sum + Math.max(1, ad.bidCpm), 0);
  let randomVal = Math.random() * totalWeight;

  for (const ad of eligible) {
    const weight = Math.max(1, ad.bidCpm);
    if (randomVal <= weight) {
      return ad;
    }
    randomVal -= weight;
  }

  return eligible[0];
}

/**
 * Safe ad validation helper.
 */
export function validateAdPayload(data: {
  title?: string;
  description?: string;
  ctaText?: string;
  targetUrl?: string;
  logoUrl?: string;
  advertiserEmail?: string;
  impressions?: number;
  bidCpm?: number;
}): { valid: boolean; error?: string } {
  if (!data.title || data.title.trim().length < 2 || data.title.length > 50) {
    return { valid: false, error: 'Title must be between 2 and 50 characters.' };
  }
  if (!data.description || data.description.trim().length < 5 || data.description.length > 140) {
    return { valid: false, error: 'Description must be between 5 and 140 characters.' };
  }
  if (!data.targetUrl || !/^https?:\/\//i.test(data.targetUrl.trim())) {
    return { valid: false, error: 'Target URL must be a valid http(s) URL.' };
  }
  const logoTrimmed = data.logoUrl ? data.logoUrl.trim() : '';
  const isValidLogo =
    /^https?:\/\//i.test(logoTrimmed) ||
    /^\/api\/ads\/logo\//i.test(logoTrimmed) ||
    /^\/logos\//i.test(logoTrimmed);
  if (!data.logoUrl || !isValidLogo) {
    return { valid: false, error: 'Please upload a logo image for your ad.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.advertiserEmail || !emailRegex.test(data.advertiserEmail.trim())) {
    return { valid: false, error: 'Please provide a valid advertiser email for campaign tracking and notifications.' };
  }
  if (!data.impressions || data.impressions < 1000) {
    return { valid: false, error: 'Minimum impression block is 1,000 impressions.' };
  }
  if (!data.bidCpm || data.bidCpm < 100) {
    return { valid: false, error: 'Minimum CPM bid is $1.00 (100 cents).' };
  }
  return { valid: true };
}

export type PlaceholderVariantId =
  | 'promote_tool'
  | 'promote_app'
  | 'promote_site'
  | 'reach_developers'
  | 'launch_sponsorship';

export type PlaceholderVariant = {
  id: PlaceholderVariantId;
  headline: string;
  body: string;
  ctaText: string;
  badgeText: string;
};

export const PLACEHOLDER_VARIANTS: PlaceholderVariant[] = [
  {
    id: 'promote_tool',
    headline: 'Promote Your Tool',
    body: 'Reach AI developers and software engineers actively discovering MCP tools.',
    ctaText: 'Sponsor AllMCPs',
    badgeText: 'Sponsor Space',
  },
  {
    id: 'promote_app',
    headline: 'Promote Your App',
    body: 'Put your application in front of builders configuring tools for Claude Desktop, Cursor & Windsurf.',
    ctaText: 'Advertise Your App',
    badgeText: 'Featured Partner',
  },
  {
    id: 'promote_site',
    headline: 'Promote Your Site & Product',
    body: 'Drive high-intent engineering traffic directly to your documentation and product site.',
    ctaText: 'Sponsor This Spot',
    badgeText: 'Partner Space',
  },
  {
    id: 'reach_developers',
    headline: 'Reach Active AI Engineers',
    body: 'Showcase your developer tools, APIs, or cloud infrastructure to active AI developers.',
    ctaText: 'Book Sponsorship',
    badgeText: 'Reach Developers',
  },
  {
    id: 'launch_sponsorship',
    headline: 'Put Your Tool in the Spotlight',
    body: 'Native logo & copy placement across directory browse cards, detail sidebars, and guides.',
    ctaText: 'Launch Campaign',
    badgeText: 'Spotlight',
  },
];

export function getRandomPlaceholderVariant(seed?: number): PlaceholderVariant {
  if (seed !== undefined) {
    const idx = Math.abs(seed) % PLACEHOLDER_VARIANTS.length;
    return PLACEHOLDER_VARIANTS[idx];
  }
  const idx = Math.floor(Math.random() * PLACEHOLDER_VARIANTS.length);
  return PLACEHOLDER_VARIANTS[idx];
}

/**
 * Logs an AI-agent injection of a sponsor ad (e.g. appended to an MCP search response).
 * These are free placements — they never touch impressionsServed / the purchased credit
 * balance — but are still logged so advertisers have real data on AI reach.
 */
export async function logAiInjectionEvent(adId: string, placement: AdPlacement = 'all'): Promise<void> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (!ctx?.env?.DB) return;

    const { drizzle } = await import('drizzle-orm/d1');
    const { sponsorAdLogs } = await import('@/db/schema');

    const db = drizzle(ctx.env.DB);
    await db.insert(sponsorAdLogs).values({
      adId,
      eventType: 'ai_injection',
      placement,
      sessionHash: null,
      createdAt: new Date(),
    });
  } catch {
    // best-effort logging only
  }
}

/** Fetches a weighted active sponsor ad directly from D1 for API & AI agent queries */
export async function fetchActiveSponsorAd(placement: AdPlacement = 'all'): Promise<SponsorAd | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (!ctx?.env?.DB) return null;

    const { drizzle } = await import('drizzle-orm/d1');
    const { sponsorAds } = await import('@/db/schema');
    const { eq, or, and, lt } = await import('drizzle-orm');

    const db = drizzle(ctx.env.DB);
    const candidateAds = await db
      .select()
      .from(sponsorAds)
      .where(
        and(
          eq(sponsorAds.status, 'active'),
          lt(sponsorAds.impressionsServed, sponsorAds.totalImpressionsPurchased),
          placement === 'all'
            ? undefined
            : or(eq(sponsorAds.placement, placement), eq(sponsorAds.placement, 'all'))
        )
      );

    if (!candidateAds || candidateAds.length === 0) return null;
    return selectWeightedAd(candidateAds as SponsorAd[]);
  } catch {
    return null;
  }
}

