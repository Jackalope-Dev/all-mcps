import { ArrowRight, Check, Megaphone, Sparkles, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader, PageShell } from '../../components/PageShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
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
    'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, real-time agent analytics, and priority 24h verification.',
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
      'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, real-time agent analytics, and priority 24h verification.',
    url: 'https://allmcps.com/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing & Sponsorships — Featured MCP Listings | AllMCPs',
    description:
      'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, real-time agent analytics, and priority 24h verification.',
  },
};

const FAQ_ITEMS = [
  {
    q: 'Is it really free to list my MCP server on AllMCPs?',
    a: 'Yes, 100% free forever. Every submitted MCP server undergoes security and schema verification and is indexed in search, category directories, and public agent endpoints.',
  },
  {
    q: 'How fast is Priority Review ($5) processed?',
    a: 'Priority Review guarantees your submission is reviewed, verified, and published within 24 hours (most submissions are published in under 6 hours).',
  },
  {
    q: 'What is included in the Premium subscription ($19/mo)?',
    a: 'Premium gives your MCP continuous featured rotation on the homepage and directory grid, a high-value dofollow SEO backlink, real-time LLM access analytics, a glowing Verified/Premium badge, and instant listing edits.',
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

function CheckCell({ ok, fallback }: { ok: boolean; fallback?: ReactNode }) {
  if (!ok) {
    return fallback !== undefined ? (
      fallback
    ) : (
      <X size={16} color="var(--text-secondary)" />
    );
  }
  return <Check size={18} color="var(--verified-green)" />;
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageShell variant="tool">
        <PageHeader
          centered
          badge={
            <>
              <Sparkles size={14} color="var(--accent-color)" /> Elevate Your
              MCP Discovery
            </>
          }
          title="Pricing & Promotion Options"
          description={
            <>
              Listing on AllMCPs is <strong>100% free forever</strong>. Upgrade
              anytime to jump the review queue, sponsor your category, or unlock
              continuous featured reach &amp; dofollow SEO power.
            </>
          }
        />

        <Card padding="md" className="pricing-stats-bar">
          <div className="pricing-stat">
            <p className="pricing-stat-value">
              {siteStats.totalServers.toLocaleString()}
            </p>
            <p className="pricing-stat-label">MCP Servers Indexed</p>
          </div>
          <div
            className="pricing-stat"
            style={{ color: 'var(--accent-color)' }}
          >
            <p
              className="pricing-stat-value"
              style={{ color: 'var(--accent-color)' }}
            >
              {siteStats.categoryCount.toLocaleString()}
            </p>
            <p className="pricing-stat-label">Active Categories</p>
          </div>
          <div className="pricing-stat">
            <p
              className="pricing-stat-value"
              style={{ color: 'var(--verified-green)' }}
            >
              {siteStats.toolsIndexed > 0
                ? siteStats.toolsIndexed.toLocaleString()
                : '—'}
            </p>
            <p className="pricing-stat-label">Tools Introspected</p>
          </div>
          <div className="pricing-stat">
            <p
              className="pricing-stat-value"
              style={{ color: 'var(--gold-color)' }}
            >
              &lt; 24h
            </p>
            <p className="pricing-stat-label">Priority Queue Turnaround</p>
          </div>
        </Card>

        <p className="pricing-trust-link">
          Want to inspect our live platform traffic and AI crawler activity?{' '}
          <Link
            href="/trust"
            style={{ color: 'var(--accent-color)', fontWeight: 600 }}
          >
            View Trust &amp; Traffic Transparency →
          </Link>
        </p>

        {canceled && (
          <p className="pricing-alert">
            Checkout canceled. You can try again anytime.
          </p>
        )}

        {/* Main Listing Tiers */}
        <section className="pricing-section">
          <div className="pricing-section-header">
            <span className="pricing-step-badge">1</span>
            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
              Choose a plan
            </h2>
          </div>

          <div className="pricing-tier-grid">
            <Card padding="lg" className="tier-card">
              <div className="tier-eyebrow-row">
                <span className="tier-eyebrow">Free Forever</span>
              </div>
              <h3 className="tier-title">{FREE_TIER.name}</h3>
              <p className="tier-tagline">{FREE_TIER.tagline}</p>
              <div className="tier-price-row">
                <span className="tier-price">$0</span>
                <span className="tier-price-suffix"> forever</span>
              </div>
              <p
                className="tier-hint"
                style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}
              >
                {FREE_TIER.placementHint}
              </p>
              <ul className="tier-benefits">
                {FREE_TIER.benefits.map((b) => (
                  <li key={b} className="tier-benefit">
                    <Check size={16} color="var(--accent-color)" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Button href="/submit" variant="secondary" className="tier-cta">
                Submit for free
              </Button>
            </Card>

            <Card
              padding="lg"
              accent="var(--accent-color)"
              className="tier-card tier-card--featured"
              id="premium"
            >
              <div className="tier-eyebrow-row">
                <span className="tier-eyebrow tier-eyebrow--accent">
                  Most Popular
                </span>
                {premium.badgeText && (
                  <span className="tier-pill">{premium.badgeText}</span>
                )}
              </div>
              <h3 className="tier-title">{premium.name} Subscription</h3>
              <p className="tier-tagline">{premium.tagline}</p>

              <div className="tier-price-row">
                <span className="tier-price">
                  {formatUsd(premium.unitAmount)}
                </span>
                <span className="tier-price-suffix">/mo</span>
                <span className="tier-savings-badge">
                  Or $149/yr (Save 35%)
                </span>
              </div>

              {premium.placementHint && (
                <p className="tier-hint">📌 {premium.placementHint}</p>
              )}

              <ul className="tier-benefits">
                {premium.benefits.map((b) => (
                  <li key={b} className="tier-benefit tier-benefit--strong">
                    <Check size={16} color="var(--accent-color)" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Button
                href={checkoutHref(premium.sku)}
                variant="primary"
                className="tier-cta"
              >
                Get Premium Now <ArrowRight size={16} />
              </Button>
            </Card>
          </div>
        </section>

        {/* One-Time Boost Options */}
        <section className="pricing-section">
          <div className="pricing-section-header is-centered">
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                marginBottom: '0.4rem',
              }}
            >
              One-Time Boost Upgrades
            </h2>
            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                maxWidth: '580px',
              }}
            >
              Single-payment visibility packages designed to amplify your MCP
              launch or category reach without a recurring subscription.
            </p>
          </div>

          <div className="pricing-boost-grid">
            {boostSkus.map((boostSku) => {
              const p = PAID_PRODUCTS[boostSku];
              return (
                <Card
                  padding="md"
                  key={boostSku}
                  className="tier-card tier-card--boost"
                  style={{ scrollMarginTop: '5rem' }}
                >
                  <div className="tier-eyebrow-row">
                    <span className="tier-eyebrow tier-eyebrow--accent">
                      One-Time Boost
                    </span>
                    {p.badgeText && (
                      <span className="tier-pill tier-pill--muted">
                        {p.badgeText}
                      </span>
                    )}
                  </div>
                  <h3 className="tier-title">{p.name}</h3>
                  <p className="tier-tagline">{p.tagline}</p>
                  <div className="tier-price-row">
                    <span className="tier-price">
                      {formatUsd(p.unitAmount)}
                    </span>
                    {p.weeklyTiers && (
                      <span className="tier-price-suffix">/wk</span>
                    )}
                  </div>
                  {p.weeklyTiers && (
                    <p className="tier-savings-note">
                      Buy {p.maxWeeks || 8} weeks at checkout — save up to{' '}
                      {tieredSavingsPct(p, p.maxWeeks || 8)}%
                    </p>
                  )}
                  {p.placementHint && (
                    <p className="tier-hint tier-hint--muted">
                      📌 {p.placementHint}
                    </p>
                  )}
                  <ul className="tier-benefits">
                    {p.benefits.map((b) => (
                      <li key={b} className="tier-benefit">
                        <Check size={15} color="var(--accent-color)" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    href={checkoutHref(p.sku)}
                    variant="secondary"
                    className="tier-cta"
                  >
                    Select Boost →
                  </Button>
                </Card>
              );
            })}

            <Card
              padding="md"
              accent="var(--accent-color)"
              className="tier-card tier-card--boost"
              style={{ scrollMarginTop: '5rem' }}
            >
              <div className="tier-eyebrow-row">
                <span className="tier-eyebrow tier-eyebrow--accent">
                  Universal Ad Network
                </span>
                <span className="tier-pill">Any Product / CPM</span>
              </div>
              <h3 className="tier-title">Sponsor Ad Spaces</h3>
              <p className="tier-tagline">
                Promote any developer tool, API, SaaS, or site across AllMCPs.
              </p>
              <div className="tier-price-row">
                <span className="tier-price">$5.00</span>
                <span className="tier-price-suffix"> / 1k views</span>
              </div>
              <p className="tier-savings-note">
                1k to 100k+ impression credit blocks with weighted CPM bidding
              </p>
              <p className="tier-hint tier-hint--muted">
                📌 Placed natively across directory cards, listing sidebars, and
                guides
              </p>
              <ul className="tier-benefits">
                <li className="tier-benefit">
                  <Check size={15} color="var(--accent-color)" />
                  <span>
                    Reach active AI developers &amp; software engineers
                  </span>
                </li>
                <li className="tier-benefit">
                  <Check size={15} color="var(--accent-color)" />
                  <span>Custom copy, logo icon, and direct outbound link</span>
                </li>
                <li className="tier-benefit">
                  <Check size={15} color="var(--accent-color)" />
                  <span>
                    Real-time impressions &amp; CTR reporting dashboard
                  </span>
                </li>
              </ul>
              <Button href="/advertise" variant="primary" className="tier-cta">
                Launch Sponsor Ad →
              </Button>
            </Card>
          </div>
        </section>

        {/* Feature Comparison Matrix */}
        <section className="pricing-section">
          <div className="pricing-section-header is-centered">
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                marginBottom: '0.4rem',
              }}
            >
              Feature Comparison Matrix
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Compare what is included across every tier and upgrade.
            </p>
          </div>

          <Card padding="sm" className="pricing-table-wrap">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>Features &amp; Benefits</th>
                  <th>Free Listing</th>
                  <th style={{ color: 'var(--accent-color)' }}>
                    Priority ($5)
                  </th>
                  <th style={{ color: 'var(--accent-color)' }}>
                    Featured ($12/wk)
                  </th>
                  <th className="is-highlight">Premium ($19/mo)</th>
                  <th style={{ color: 'var(--accent-color)' }}>
                    Sponsor Ads ($5 CPM)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Directory Search &amp; Category Indexing</td>
                  <td>
                    <CheckCell ok />
                  </td>
                  <td>
                    <CheckCell ok />
                  </td>
                  <td>
                    <CheckCell ok />
                  </td>
                  <td className="is-highlight">
                    <CheckCell ok />
                  </td>
                  <td>
                    <CheckCell ok />
                  </td>
                </tr>
                <tr>
                  <td>Guaranteed &lt; 24h Review Turnaround</td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok />
                  </td>
                  <td>
                    <CheckCell ok />
                  </td>
                  <td className="is-highlight">
                    <CheckCell ok />
                  </td>
                  <td>Instant Launch</td>
                </tr>
                <tr>
                  <td>Homepage Discovery Grid Spotlight</td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok />
                  </td>
                  <td className="is-highlight">
                    <CheckCell ok />
                  </td>
                  <td>
                    <CheckCell ok />
                  </td>
                </tr>
                <tr>
                  <td>Native Sidebars &amp; Guide Banners</td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td className="is-highlight">
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok />
                  </td>
                </tr>
                <tr>
                  <td>Dofollow SEO Website Backlink</td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td className="is-highlight">
                    <CheckCell ok />
                  </td>
                  <td>Direct Link</td>
                </tr>
                <tr>
                  <td>Live Impressions &amp; CTR Analytics</td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td>
                    <CheckCell ok={false} />
                  </td>
                  <td className="is-highlight">
                    <CheckCell ok />
                  </td>
                  <td>
                    <CheckCell ok />
                  </td>
                </tr>
                <tr>
                  <td>Works for Any App, API or Website</td>
                  <td>MCP Only</td>
                  <td>MCP Only</td>
                  <td>MCP Only</td>
                  <td className="is-highlight">MCP Only</td>
                  <td>
                    <CheckCell ok />
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </section>

        {/* Don't have an MCP Server? Universal Advertiser Banner */}
        <Card
          padding="md"
          accent="var(--accent-color)"
          className="pricing-promo-banner"
          style={{ marginBottom: '4rem' }}
        >
          <div className="pricing-promo-content">
            <div className="pricing-promo-icon">
              <Megaphone size={24} />
            </div>
            <div>
              <div className="pricing-promo-tag-row">
                <span className="pricing-promo-tag">
                  No MCP Server Required
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  For Developers, SaaS, Apps &amp; Startups
                </span>
              </div>
              <h3 className="pricing-promo-title">
                Want to promote your App, Developer Tool, API, or Website?
              </h3>
              <p className="pricing-promo-desc">
                You don&apos;t need to have an MCP server listed to reach our
                audience. Sponsor native logo + copy ad units across directory
                cards, listing sidebars, and guide articles starting at{' '}
                <strong>$5.00 per 1,000 views</strong> with live reporting and
                weighted CPM bidding.
              </p>
            </div>
          </div>
          <Button
            href="/advertise"
            variant="primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            Create Sponsor Ad <ArrowRight size={16} />
          </Button>
        </Card>

        {/* Step 2 Checkout Selection Component */}
        <PricingClient
          initialServerId={serverId}
          initialCategory={
            typeof params.category === 'string' ? params.category : ''
          }
          initialSku={sku}
        />

        {/* Frequently Asked Questions */}
        <section className="pricing-section" style={{ marginTop: '4.5rem' }}>
          <div className="pricing-section-header is-centered">
            <h2
              style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                marginBottom: '0.4rem',
              }}
            >
              Frequently Asked Questions
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Everything you need to know about listing, boosting, and billing
              on AllMCPs.
            </p>
          </div>

          <FaqSection
            items={FAQ_ITEMS.map((item) => ({
              question: item.q,
              answer: item.a,
            }))}
            defaultOpenIndex={0}
            renderJsonLd={false}
          />
        </section>

        <p
          style={{
            textAlign: 'center',
            marginTop: '3rem',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}
        >
          Free forever to list and claim.{' '}
          <Link
            href="/submit"
            style={{ color: 'var(--accent-color)', fontWeight: 600 }}
          >
            Submit an MCP Server
          </Link>{' '}
          or{' '}
          <Link
            href="/browse"
            style={{ color: 'var(--accent-color)', fontWeight: 600 }}
          >
            Browse the Directory
          </Link>
          .
        </p>
      </PageShell>
    </>
  );
}
