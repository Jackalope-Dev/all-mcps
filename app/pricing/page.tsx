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
  searchParams: Promise<{ serverId?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const serverId = typeof params.serverId === 'string' ? params.serverId : '';
  const canceled = params.canceled === '1';

  return (
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem',
        }}
      >
        <div
          className="surface"
          style={{ padding: '1.75rem', borderRadius: '16px' }}
        >
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--accent-color)',
              marginBottom: '0.5rem',
            }}
          >
            Free
          </p>
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>{FREE_TIER.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>{FREE_TIER.tagline}</p>
          <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1.25rem' }}>{formatUsd(FREE_TIER.unitAmount)}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {FREE_TIER.benefits.map((b) => (
              <li key={b} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                <span style={{ color: 'var(--accent-color)', marginRight: '0.4rem' }}>✓</span>
                {b}
              </li>
            ))}
          </ul>
          <Link
            href="/submit"
            className="btn btn-secondary"
            style={{ display: 'inline-block', width: '100%', textAlign: 'center' }}
          >
            Submit for free
          </Link>
        </div>
        {(Object.keys(PAID_PRODUCTS) as Array<keyof typeof PAID_PRODUCTS>).map((sku) => {
          const p = PAID_PRODUCTS[sku];
          const price =
            p.interval === 'month' ? `${formatUsd(p.unitAmount)}/mo` : formatUsd(p.unitAmount);
          const highlight = sku === 'premium_monthly';
          return (
            <div
              key={sku}
              className="surface"
              style={{
                padding: '1.75rem',
                borderRadius: '16px',
                border: highlight ? '1px solid rgba(0,229,255,0.4)' : undefined,
                background: highlight
                  ? 'linear-gradient(160deg, rgba(0,229,255,0.1), rgba(0,123,255,0.06), transparent)'
                  : undefined,
              }}
            >
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-color)',
                  marginBottom: '0.5rem',
                }}
              >
                {p.interval === 'month' ? 'Subscription' : 'One-time'}
              </p>
              <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>{p.name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>{p.tagline}</p>
              <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1.25rem' }}>{price}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {p.benefits.map((b) => (
                  <li key={b} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    <span style={{ color: 'var(--accent-color)', marginRight: '0.4rem' }}>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <PricingClient initialServerId={serverId} />

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
  );
}
