import { Metadata } from 'next';
import Link from 'next/link';
import { PricingClient } from './PricingClient';
import { PAID_PRODUCTS, FREE_TIER, formatUsd } from '../../lib/pricing';

export const metadata: Metadata = {
  title: 'AllMCPs Pricing — Free & Featured MCP Listings',
  description:
    'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, and priority verification for your AI tool.',
  alternates: { canonical: 'https://allmcps.com/pricing' },
  openGraph: {
    title: 'AllMCPs Pricing — Free & Featured MCP Listings | AllMCPs',
    description:
      'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, and priority verification.',
    url: 'https://allmcps.com/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AllMCPs Pricing — Free & Featured MCP Listings | AllMCPs',
    description:
      'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, and priority verification.',
  },
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ serverId?: string; category?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const serverId = typeof params.serverId === 'string' ? params.serverId : '';
  const canceled = params.canceled === '1';

  const SITE = 'https://allmcps.com';
  // Offers built from the same source of truth the cards render, so structured data
  // never drifts from the displayed prices. unitAmount is in cents.
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: 'AllMCPs Directory Listing',
        description:
          'List a Model Context Protocol server on AllMCPs for free, or promote it with priority review, a featured boost, or ongoing Premium placement.',
        brand: { '@type': 'Brand', name: 'AllMCPs' },
        url: `${SITE}/pricing`,
        offers,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${SITE}/pricing` },
        ],
      },
    ],
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <main className="container page-shell" style={{ maxWidth: '1140px', paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="text-page-title" style={{ marginBottom: '0.75rem' }}>Pricing & Boosting</h1>
        <p className="text-lead" style={{ margin: '0 auto', textAlign: 'center', maxWidth: '640px' }}>
          Listing on AllMCPs is free forever. Paid options are optional — for faster review turnaround, category sponsorships, or ongoing premium placement.
        </p>
      </div>

      {canceled && (
        <p
          style={{
            textAlign: 'center',
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.3)',
            color: '#fca5a5',
            fontSize: '0.9rem',
          }}
        >
          Checkout canceled. You can try again anytime.
        </p>
      )}

      {/* Main Listing Tiers */}
      <div style={{ marginBottom: '3rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {/* Free Listing Card */}
          <div
            className="surface"
            style={{
              padding: '2rem',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                }}
              >
                Free Forever
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{FREE_TIER.name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>{FREE_TIER.tagline}</p>
            <p style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>{formatUsd(FREE_TIER.unitAmount)}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontStyle: 'italic' }}>
              {FREE_TIER.placementHint}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
              {FREE_TIER.benefits.map((b) => (
                <li key={b} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <span style={{ color: 'var(--accent-color)', marginRight: '0.5rem', fontWeight: 700 }}>✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <Link
              href="/submit"
              className="btn btn-secondary"
              style={{ display: 'inline-block', width: '100%', textAlign: 'center', padding: '0.75rem', fontWeight: 600 }}
            >
              Submit for free
            </Link>
          </div>

          {/* Premium Subscription Card */}
          {(() => {
            const p = PAID_PRODUCTS.premium_monthly;
            return (
              <div
                key={p.sku}
                id="premium"
                className="surface"
                style={{
                  padding: '2rem',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid rgba(0,229,255,0.5)',
                  background: 'linear-gradient(160deg, rgba(0,229,255,0.12), rgba(0,123,255,0.08), transparent)',
                  scrollMarginTop: '5rem',
                  boxShadow: '0 8px 32px rgba(0, 229, 255, 0.12)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#00E5FF',
                    }}
                  >
                    Most Popular
                  </span>
                  {p.badgeText && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(0,229,255,0.2)',
                        color: '#00E5FF',
                        border: '1px solid rgba(0,229,255,0.4)',
                      }}
                    >
                      {p.badgeText}
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{p.name}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>{p.tagline}</p>
                <p style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                  {formatUsd(p.unitAmount)}<span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>/mo</span>
                </p>
                {p.placementHint && (
                  <p style={{ fontSize: '0.8rem', color: '#00E5FF', marginBottom: '1.5rem', fontWeight: 500 }}>
                    📌 {p.placementHint}
                  </p>
                )}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
                  {p.benefits.map((b) => (
                    <li key={b} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      <span style={{ color: '#00E5FF', marginRight: '0.5rem', fontWeight: 700 }}>✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>
      </div>

      {/* One-Time Boost Options Section */}
      <div style={{ marginBottom: '3.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.35rem' }}>One-Time Boost Upgrades</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 auto' }}>
            Single-payment visibility packages to amplify your MCP launch or category reach.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {(['priority_review', 'featured_7d', 'category_sponsor_7d'] as const).map((sku) => {
            const p = PAID_PRODUCTS[sku];
            const isCategorySponsor = sku === 'category_sponsor_7d';
            return (
              <div
                key={sku}
                id={isCategorySponsor ? 'category_sponsor_7d' : undefined}
                className="surface"
                style={{
                  padding: '1.75rem',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  border: isCategorySponsor ? '1px solid rgba(255,215,0,0.35)' : '1px solid var(--border-color)',
                  background: isCategorySponsor
                    ? 'linear-gradient(160deg, rgba(255,215,0,0.08), rgba(255,140,0,0.04), transparent)'
                    : undefined,
                  scrollMarginTop: '5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: isCategorySponsor ? '#ffd700' : 'var(--accent-color)',
                    }}
                  >
                    One-Time Boost
                  </span>
                  {p.badgeText && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        background: isCategorySponsor ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)',
                        color: isCategorySponsor ? '#ffd700' : 'var(--text-primary)',
                        border: `1px solid ${isCategorySponsor ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.15)'}`,
                      }}
                    >
                      {p.badgeText}
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', fontWeight: 700 }}>{p.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>{p.tagline}</p>
                <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.35rem' }}>{formatUsd(p.unitAmount)}</p>
                {p.placementHint && (
                  <p style={{ fontSize: '0.75rem', color: isCategorySponsor ? '#ffd700' : 'var(--text-secondary)', marginBottom: '1.25rem', fontWeight: 500 }}>
                    📌 {p.placementHint}
                  </p>
                )}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                  {p.benefits.map((b) => (
                    <li key={b} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      <span style={{ color: isCategorySponsor ? '#ffd700' : 'var(--accent-color)', marginRight: '0.4rem', fontWeight: 700 }}>✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <PricingClient initialServerId={serverId} initialCategory={typeof params.category === 'string' ? params.category : ''} />

      <p style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Free forever to list and claim.{' '}
        <Link href="/submit" style={{ color: 'var(--accent-color)' }}>
          Submit an MCP
        </Link>{' '}
        or{' '}
        <Link href="/browse" style={{ color: 'var(--accent-color)' }}>
          browse the directory
        </Link>
        .
      </p>
    </main>
    </>
  );
}
