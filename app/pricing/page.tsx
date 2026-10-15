import {
  ArrowRight,
  Check,
  Crown,
  Megaphone,
  Minus,
  Package,
  Rocket,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { serializeJsonLd } from '@/lib/jsonLd';
import { PageShell } from '../../components/PageShell';
import { Button } from '../../components/ui/Button';
import { FaqSection } from '../../components/ui/FaqSection';
import {
  FREE_TIER,
  formatUsd,
  PAID_PRODUCTS,
  type PaidSku,
  tieredSavingsPct,
} from '../../lib/pricing';
import { getSiteStats } from '../../lib/siteStats';
import { PricingClient } from './PricingClient';

export const metadata: Metadata = {
  title: 'Pricing & Sponsorships — Featured MCP Listings',
  description:
    'Promote your Model Context Protocol server on AllMCPs with featured placements, dofollow backlinks, real-time agent analytics, and priority review.',
  alternates: { canonical: 'https://allmcps.com/pricing' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Pricing & Sponsorships — Featured MCP Listings | AllMCPs',
    description:
      'Promote your Model Context Protocol server on AllMCPs with featured placements, dofollow backlinks, real-time agent analytics, and priority review.',
    url: 'https://allmcps.com/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing & Sponsorships — Featured MCP Listings | AllMCPs',
    description:
      'Promote your Model Context Protocol server on AllMCPs with featured placements, dofollow backlinks, real-time agent analytics, and priority review.',
  },
};

const FAQ_ITEMS = [
  {
    q: 'Is it really free to list my MCP server on AllMCPs?',
    a: 'Yes, 100% free forever. Every submitted MCP server undergoes security and schema verification and is indexed in search, category directories, and public agent endpoints.',
  },
  {
    q: 'How fast is Priority Review ($5) processed?',
    a: 'Priority Review moves your submission to the front of the review queue, ahead of every free submission. We aim to review priority submissions within 24 hours, and you are emailed as soon as it is published.',
  },
  {
    q: 'What is included in the Premium subscription ($19/mo)?',
    a: 'Premium gives your MCP continuous featured rotation on the homepage and directory grid, a high-value dofollow SEO backlink, real-time LLM access analytics, and a Verified badge with a glowing featured card.',
  },
  {
    q: 'What is a Dofollow backlink and why does it matter for my project?',
    a: 'Unlike standard nofollow links, a dofollow backlink passes domain authority directly to your project site or GitHub repo, accelerating Google ranking and domain authority for your brand.',
  },
  {
    q: 'How do volume discounts work on Featured & Category Sponsorships?',
    a: 'You can select up to 8 weeks at checkout. Purchasing 2-3 weeks saves 10%, while 4+ weeks unlocks a 25% volume discount automatically.',
  },
  {
    q: 'Can I cancel or change my Premium subscription at any time?',
    a: 'Yes, absolutely. You can manage invoices, change billing methods, or cancel anytime in one click via the Stripe Billing Portal with zero lock-in or cancellation fees.',
  },
];

type Cell = boolean | string;

/** Feature matrix rows: Free, Priority, Featured, Premium, Sponsor ads. */
const MATRIX: { feature: string; cells: [Cell, Cell, Cell, Cell, Cell] }[] = [
  {
    feature: 'Directory search & category indexing',
    cells: [true, true, true, true, true],
  },
  {
    feature: 'Front-of-queue review',
    cells: [false, true, false, false, false],
  },
  {
    feature: 'Homepage discovery spotlight',
    cells: [false, false, true, true, false],
  },
  {
    feature: 'Native sidebar & guide banners',
    cells: [false, false, false, false, true],
  },
  {
    feature: 'Dofollow website backlink',
    cells: [false, false, false, true, 'Direct link'],
  },
  {
    feature: 'Live impressions & CTR analytics',
    cells: [false, false, true, true, true],
  },
  {
    feature: 'Promotes any app, API or website',
    cells: ['MCP only', 'MCP only', 'MCP only', 'MCP only', true],
  },
];

const MATRIX_COLS = [
  'Free',
  'Priority · $5',
  'Featured · $12/wk',
  'Premium · $19/mo',
  'Sponsor ads · $5 CPM',
];

function MatrixCell({ value }: { value: Cell }) {
  if (value === true)
    return <Check size={17} className="acct-yes" aria-label="Included" />;
  if (value === false)
    return <Minus size={15} className="acct-no" aria-label="Not included" />;
  return <span className="acct-cell-text">{value}</span>;
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{
    serverId?: string;
    category?: string;
    canceled?: string;
    sku?: string;
  }>;
}) {
  const [params, siteStats] = await Promise.all([searchParams, getSiteStats()]);
  const serverId = typeof params.serverId === 'string' ? params.serverId : '';
  const canceled = params.canceled === '1';
  const sku: PaidSku | null =
    typeof params.sku === 'string' && params.sku in PAID_PRODUCTS
      ? (params.sku as PaidSku)
      : null;

  const checkoutHref = (targetSku: PaidSku) =>
    `/pricing?sku=${targetSku}${serverId ? `&serverId=${encodeURIComponent(serverId)}` : ''}#checkout`;

  const SITE = 'https://allmcps.com';
  const offers = [FREE_TIER, ...Object.values(PAID_PRODUCTS)].map((p) => ({
    '@type': 'Offer',
    name: p.name,
    description: p.tagline,
    price: (p.unitAmount / 100).toFixed(2),
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: `${SITE}/pricing`,
    ...(p.interval === 'month'
      ? {
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: (p.unitAmount / 100).toFixed(2),
            priceCurrency: 'USD',
            unitCode: 'MON',
          },
        }
      : {}),
  }));

  const faqSchema = {
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: 'AllMCPs Directory Listing & Promotion',
        description:
          'List a Model Context Protocol server on AllMCPs for free, or promote it with priority review, featured boost, or ongoing Premium placement.',
        brand: { '@type': 'Brand', name: 'AllMCPs' },
        url: `${SITE}/pricing`,
        offers,
      },
      faqSchema,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Pricing',
            item: `${SITE}/pricing`,
          },
        ],
      },
    ],
  };

  const premium = PAID_PRODUCTS.premium_monthly;
  const boostSkus = ['priority_review', 'featured_7d'] as const;
  const featured = PAID_PRODUCTS.featured_7d;
  const featuredMaxWeeks = featured.maxWeeks || 8;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <PageShell variant="default" className="acct-pricing">
        <header className="acct-page-head acct-page-head--center">
          <h1 className="text-page-title">
            Pricing: free to list, pay only to stand out
          </h1>
          <p className="text-lead">
            Every MCP server is listed <strong>free, forever</strong>. Upgrade
            when you want to skip the review queue, get featured, or earn a
            dofollow backlink.
          </p>
        </header>

        <ul className="acct-proof" aria-label="Directory at a glance">
          <li>
            <strong className="tabular">
              {siteStats.totalServers.toLocaleString()}
            </strong>
            <span>servers indexed</span>
          </li>
          <li>
            <strong className="tabular">
              {siteStats.categoryCount.toLocaleString()}
            </strong>
            <span>categories</span>
          </li>
          {siteStats.toolsIndexed > 0 ? (
            <li>
              <strong className="tabular">
                {siteStats.toolsIndexed.toLocaleString()}
              </strong>
              <span>tools indexed</span>
            </li>
          ) : null}
          <li>
            <strong className="tabular">
              {formatUsd(PAID_PRODUCTS.priority_review.unitAmount)}
            </strong>
            <span>priority review</span>
          </li>
          <li>
            <Link href="/trust" className="link-arrow">
              Live traffic data
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </li>
        </ul>

        {canceled && (
          <p className="acct-callout acct-callout--warn acct-pricing-alert">
            Checkout canceled — nothing was charged. You can try again anytime.
          </p>
        )}

        <section className="acct-tiers" aria-label="Plans">
          <article className="acct-tier hue-teal">
            <header>
              <span className="acct-tier-icon tint-tile" aria-hidden="true">
                <Package size={18} />
              </span>
              <h2 className="acct-tier-name">{FREE_TIER.name}</h2>
              <p className="acct-tier-tagline">{FREE_TIER.tagline}</p>
            </header>
            <p className="acct-tier-price">
              <span className="tabular">$0</span>
              <span className="acct-tier-per">forever</span>
            </p>
            <Button href="/submit" variant="secondary" fullWidth>
              Submit for free
            </Button>
            <ul className="acct-tier-list">
              {FREE_TIER.benefits.map((b) => (
                <li key={b}>
                  <Check size={15} aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </article>

          <article
            className="acct-tier acct-tier--featured hue-violet"
            id="premium"
          >
            <span className="acct-tier-flag">Recommended</span>
            <header>
              <span className="acct-tier-icon tint-tile" aria-hidden="true">
                <Crown size={18} />
              </span>
              <h2 className="acct-tier-name">{premium.name}</h2>
              <p className="acct-tier-tagline">{premium.tagline}</p>
            </header>
            <p className="acct-tier-price">
              <span className="tabular">{formatUsd(premium.unitAmount)}</span>
              <span className="acct-tier-per">/ month</span>
            </p>
            <Button
              href={checkoutHref(premium.sku)}
              variant="primary"
              fullWidth
            >
              Get Premium
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
            <ul className="acct-tier-list">
              {premium.benefits.map((b) => (
                <li key={b}>
                  <Check size={15} aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="acct-tier-foot">Cancel anytime in one click.</p>
          </article>

          <article className="acct-tier hue-orange">
            <header>
              <span className="acct-tier-icon tint-tile" aria-hidden="true">
                <Rocket size={18} />
              </span>
              <h2 className="acct-tier-name">One-time boosts</h2>
              <p className="acct-tier-tagline">
                Pay once for a launch or a busy week — no subscription.
              </p>
            </header>
            <div className="acct-boost-list">
              {boostSkus.map((boostSku) => {
                const p = PAID_PRODUCTS[boostSku];
                return (
                  <Link
                    key={boostSku}
                    href={checkoutHref(p.sku)}
                    className="acct-boost"
                  >
                    <span
                      className={`acct-boost-icon ${boostSku === 'priority_review' ? 'hue-amber' : 'hue-orange'}`}
                      aria-hidden="true"
                    >
                      {boostSku === 'priority_review' ? (
                        <Zap size={16} />
                      ) : (
                        <Rocket size={16} />
                      )}
                    </span>
                    <span className="acct-boost-body">
                      <strong>{p.name}</strong>
                      <span>{p.placementHint || p.tagline}</span>
                    </span>
                    <span className="acct-boost-price tabular">
                      {formatUsd(p.unitAmount)}
                      {p.weeklyTiers ? (
                        <small className="acct-boost-per">/wk</small>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </div>
            {featured.weeklyTiers ? (
              <p className="acct-tier-foot">
                Run Featured for up to {featuredMaxWeeks} weeks and save up to{' '}
                {tieredSavingsPct(featured, featuredMaxWeeks)}%.
              </p>
            ) : null}
          </article>
        </section>

        <aside className="acct-ad-banner">
          <span className="acct-ad-banner-icon hue-pink" aria-hidden="true">
            <Megaphone size={20} />
          </span>
          <div className="acct-ad-banner-body">
            <h2>Not an MCP server? Sponsor ads work for any product.</h2>
            <p>
              Native logo + copy placements across directory cards, listing
              sidebars and guides, from <strong>$5 per 1,000 views</strong> with
              live CTR reporting.
            </p>
          </div>
          <Button href="/advertise" variant="secondary">
            Explore advertising
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </aside>

        <section className="section-tight" aria-labelledby="compare-title">
          <div className="section-head section-head--center">
            <h2 id="compare-title" className="section-title">
              Compare plans
            </h2>
            <p className="section-sub">
              What&rsquo;s included in every tier and upgrade.
            </p>
          </div>
          <div className="acct-table-wrap">
            <table className="acct-table">
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  {MATRIX_COLS.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={i === 3 ? 'is-highlight' : undefined}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    {row.cells.map((cell, i) => (
                      <td
                        key={MATRIX_COLS[i]}
                        className={i === 3 ? 'is-highlight' : undefined}
                      >
                        <MatrixCell value={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-tight" aria-label="Checkout">
          <PricingClient
            initialServerId={serverId}
            initialCategory={
              typeof params.category === 'string' ? params.category : ''
            }
            initialSku={sku}
          />
        </section>

        <section className="section-tight">
          <div className="section-head section-head--center">
            <h2 className="section-title">Questions, answered</h2>
            <p className="section-sub">
              Listing, boosting and billing on AllMCPs.
            </p>
          </div>
          <div className="acct-faq">
            <FaqSection
              items={FAQ_ITEMS.map((item) => ({
                question: item.q,
                answer: item.a,
              }))}
              defaultOpenIndex={0}
              renderJsonLd={false}
            />
          </div>
        </section>

        <div className="acct-final-cta">
          <h2>Listing is free. Start there.</h2>
          <p>Submit in about a minute — upgrade later if you want reach.</p>
          <div className="acct-final-cta-actions">
            <Button href="/submit" variant="primary" size="lg">
              Submit your server
            </Button>
            <Button href="/browse" variant="secondary" size="lg">
              Browse the directory
            </Button>
          </div>
        </div>
      </PageShell>
    </>
  );
}
