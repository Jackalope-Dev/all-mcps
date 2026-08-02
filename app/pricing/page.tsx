import { Metadata } from 'next';
import Link from 'next/link';
import { PricingClient } from './PricingClient';
import { PAID_PRODUCTS, FREE_TIER, formatUsd } from '../../lib/pricing';

export const metadata: Metadata = {
  title: 'Pricing & Featured MCP Listings',
  description:
    'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, and priority verification for your AI tool.',
  alternates: { canonical: 'https://allmcps.com/pricing' },
  openGraph: {
    title: 'Pricing & Featured MCP Listings | AllMCPs',
    description:
      'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, and priority verification.',
    url: 'https://allmcps.com/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing & Featured MCP Listings | AllMCPs',
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
    <main className="container page-shell" style={{ maxWidth: '960px', paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="text-page-title" style={{ marginBottom: '0.75rem' }}>Pricing</h1>
        <p className="text-lead" style={{ margin: '0 auto', textAlign: 'center' }}>
          Listing on AllMCPs is free. Paid options are optional — for faster review, short boosts, or ongoing featured
          placement.
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '3rem',
        }}
      >
        <div
          className="surface"
          style={{ padding: '1.75rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}
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
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>{FREE_TIER.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>{FREE_TIER.tagline}</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>{formatUsd(FREE_TIER.unitAmount)}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', fontStyle: 'italic' }}>
            {FREE_TIER.placementHint}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
            {FREE_TIER.benefits.map((b) => (
              <li key={b} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                <span style={{ color: 'var(--accent-color)', marginRight: '0.4rem', fontWeight: 700 }}>✓</span>
                {b}
              </li>
            ))}
          </ul>
          <Link
            href="/submit"
            className="btn btn-secondary"
            style={{ display: 'inline-block', width: '100%', textAlign: 'center', padding: '0.65rem' }}
          >
            Submit for free
          </Link>
        </div>
        {(Object.keys(PAID_PRODUCTS) as Array<keyof typeof PAID_PRODUCTS>).map((sku) => {
          const p = PAID_PRODUCTS[sku];
          const price =
            p.interval === 'month' ? `${formatUsd(p.unitAmount)}/mo` : formatUsd(p.unitAmount);
          const isCategorySponsor = sku === 'category_sponsor_7d';
          const isPremium = sku === 'premium_monthly';
          return (
            <div
              key={sku}
              id={isPremium ? 'premium' : isCategorySponsor ? 'category_sponsor_7d' : undefined}
              className="surface"
              style={{
                padding: '1.75rem',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                border: isPremium
                  ? '1px solid rgba(0,229,255,0.45)'
                  : isCategorySponsor
                  ? '1px solid rgba(255,215,0,0.35)'
                  : undefined,
                background: isPremium
                  ? 'linear-gradient(160deg, rgba(0,229,255,0.1), rgba(0,123,255,0.06), transparent)'
                  : isCategorySponsor
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
                    color: isPremium ? '#00E5FF' : isCategorySponsor ? '#ffd700' : 'var(--accent-color)',
                  }}
                >
                  {p.interval === 'month' ? 'Subscription' : 'One-Time Boost'}
                </span>
                {p.badgeText && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      background: isPremium ? 'rgba(0,229,255,0.15)' : isCategorySponsor ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.1)',
                      color: isPremium ? '#00E5FF' : isCategorySponsor ? '#ffd700' : 'var(--text-primary)',
                      border: `1px solid ${isPremium ? 'rgba(0,229,255,0.3)' : isCategorySponsor ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.2)'}`,
                    }}
                  >
                    {p.badgeText}
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>{p.name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>{p.tagline}</p>
              <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.35rem' }}>{price}</p>
              {p.placementHint && (
                <p style={{ fontSize: '0.75rem', color: isPremium ? '#00E5FF' : isCategorySponsor ? '#ffd700' : 'var(--text-secondary)', marginBottom: '1.25rem', fontWeight: 500 }}>
                  📌 {p.placementHint}
                </p>
              )}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1 }}>
                {p.benefits.map((b) => (
                  <li key={b} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    <span style={{ color: isPremium ? '#00E5FF' : 'var(--accent-color)', marginRight: '0.4rem', fontWeight: 700 }}>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
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
