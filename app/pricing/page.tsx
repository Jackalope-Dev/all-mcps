import { Metadata } from 'next';
import Link from 'next/link';
import { PricingClient } from './PricingClient';
import { PAID_PRODUCTS, FREE_TIER, formatUsd, tieredSavingsPct, type PaidSku } from '../../lib/pricing';
import { getSiteStats } from '../../lib/siteStats';
import { FaqSection } from '../../components/ui/FaqSection';
import { Sparkles, Zap, Crown, Check, HelpCircle, ShieldCheck, BarChart3, Link2, TrendingUp, Clock, ArrowRight, X } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing & Sponsorships — Free & Featured MCP Server Listings',
  description:
    'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, real-time agent analytics, and priority 24h verification.',
  alternates: { canonical: 'https://allmcps.com/pricing' },
  openGraph: {
    title: 'Pricing & Sponsorships — Free & Featured MCP Server Listings | AllMCPs',
    description:
      'Promote your Model Context Protocol server on AllMCPs. Get featured placements, dofollow backlinks, real-time agent analytics, and priority 24h verification.',
    url: 'https://allmcps.com/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing & Sponsorships — Free & Featured MCP Server Listings | AllMCPs',
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

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ serverId?: string; category?: string; canceled?: string; sku?: string }>;
}) {
  const [params, siteStats] = await Promise.all([searchParams, getSiteStats()]);
  const serverId = typeof params.serverId === 'string' ? params.serverId : '';
  const canceled = params.canceled === '1';
  const sku: PaidSku | null =
    typeof params.sku === 'string' && params.sku in PAID_PRODUCTS ? (params.sku as PaidSku) : null;

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
          { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${SITE}/pricing` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container page-shell" style={{ maxWidth: '1140px', paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        
        {/* Header Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '999px',
              background: 'var(--brand-gradient-soft)',
              border: '1px solid rgba(var(--accent-rgb), 0.3)',
              color: 'var(--accent-color)',
              fontSize: '0.8rem',
              fontWeight: 700,
              marginBottom: '1rem',
              letterSpacing: '0.02em',
            }}
          >
            <Sparkles size={14} color="var(--accent-color)" /> Elevate Your MCP Discovery
          </div>
          <h1 className="text-page-title" style={{ marginBottom: '0.85rem', fontSize: 'clamp(2rem, 4vw, 2.75rem)' }}>
            Pricing & Promotion Options
          </h1>
          <p className="text-lead" style={{ margin: '0 auto', textAlign: 'center', maxWidth: '680px', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
            Listing on AllMCPs is <strong>100% free forever</strong>. Upgrade anytime to jump the review queue, sponsor your category, or unlock continuous featured reach & dofollow SEO power.
          </p>
        </div>

        {/* Social Proof & Metrics Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            padding: '1.25rem 1.5rem',
            borderRadius: '16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            marginBottom: '3rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {siteStats.totalServers.toLocaleString()}+
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>MCP Servers Indexed</p>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-color)', margin: 0 }}>
              {siteStats.categoryCount.toLocaleString()}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>Active Categories</p>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--verified-green)', margin: 0 }}>
              {siteStats.toolsIndexed > 0 ? `${siteStats.toolsIndexed.toLocaleString()}+` : '3,000+'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>Tools Introspected</p>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gold-color)', margin: 0 }}>&lt; 24h</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>Priority Queue Turnaround</p>
          </div>
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
        <div style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(var(--accent-rgb), 0.15)',
                border: '1px solid rgba(var(--accent-rgb), 0.4)',
                color: 'var(--accent-color)',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              1
            </span>
            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Choose a plan</h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.75rem',
              alignItems: 'stretch',
            }}
          >
            {/* Free Listing Card */}
            <div
              className="surface"
              style={{
                padding: '2rem',
                borderRadius: '20px',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)',
                position: 'relative',
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
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', fontWeight: 800 }}>{FREE_TIER.name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>{FREE_TIER.tagline}</p>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>$0</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>forever</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontStyle: 'italic' }}>
                {FREE_TIER.placementHint}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                {FREE_TIER.benefits.map((b) => (
                  <li key={b} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.45, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <Check size={16} color="var(--accent-color)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/submit"
                className="btn btn-secondary"
                style={{ display: 'inline-flex', width: '100%', justifyContent: 'center', padding: '0.85rem', fontWeight: 700, borderRadius: '12px' }}
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
                    borderRadius: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '2px solid var(--accent-color)',
                    background: 'linear-gradient(160deg, rgba(var(--accent-rgb),0.12), rgba(var(--accent-secondary-rgb),0.06), var(--bg-elevated))',
                    scrollMarginTop: '5rem',
                    boxShadow: '0 12px 40px rgba(var(--accent-rgb), 0.18)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--accent-color)',
                      }}
                    >
                      Most Popular
                    </span>
                    {p.badgeText && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '8px',
                          background: 'rgba(var(--accent-rgb),0.2)',
                          color: 'var(--accent-color)',
                          border: '1px solid rgba(var(--accent-rgb),0.4)',
                        }}
                      >
                        {p.badgeText}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', fontWeight: 800 }}>{p.name} Subscription</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>{p.tagline}</p>
                  
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>{formatUsd(p.unitAmount)}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>/mo</span>
                    <div style={{ display: 'inline-block', marginLeft: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '6px', background: 'var(--verified-green-bg)', border: '1px solid var(--verified-green-border)', color: 'var(--verified-green)', fontSize: '0.75rem', fontWeight: 700 }}>
                      Or $149/yr (Save 35%)
                    </div>
                  </div>

                  {p.placementHint && (
                    <p style={{ fontSize: '0.825rem', color: 'var(--accent-color)', marginBottom: '1.5rem', fontWeight: 600 }}>
                      📌 {p.placementHint}
                    </p>
                  )}

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                    {p.benefits.map((b) => (
                      <li key={b} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.45, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <Check size={16} color="var(--accent-color)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
                        <span style={{ fontWeight: 500 }}>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={checkoutHref(p.sku)}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontWeight: 700, borderRadius: '12px', fontSize: '1rem' }}
                  >
                    Get Premium Now <ArrowRight size={16} style={{ marginLeft: '0.4rem' }} />
                  </a>
                </div>
              );
            })()}
          </div>
        </div>

        {/* One-Time Boost Options Section */}
        <div style={{ marginBottom: '4rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>One-Time Boost Upgrades</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '580px' }}>
              Single-payment visibility packages designed to amplify your MCP launch or category reach without a recurring subscription.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
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
                    borderRadius: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    border: isCategorySponsor ? '1px solid rgba(var(--gold-rgb),0.4)' : '1px solid var(--border-color)',
                    background: isCategorySponsor
                      ? 'linear-gradient(160deg, rgba(var(--gold-rgb),0.08), rgba(255,140,0,0.04), var(--bg-elevated))'
                      : 'var(--bg-elevated)',
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
                        color: isCategorySponsor ? 'var(--gold-color)' : 'var(--accent-color)',
                      }}
                    >
                      One-Time Boost
                    </span>
                    {p.badgeText && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          background: isCategorySponsor ? 'rgba(var(--gold-rgb),0.15)' : 'var(--bg-muted)',
                          color: isCategorySponsor ? 'var(--gold-color)' : 'var(--text-primary)',
                          border: `1px solid ${isCategorySponsor ? 'rgba(var(--gold-rgb),0.3)' : 'var(--border-color)'}`,
                        }}
                      >
                        {p.badgeText}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.3rem', marginBottom: '0.25rem', fontWeight: 800 }}>{p.name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{p.tagline}</p>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '2.25rem', fontWeight: 800 }}>
                      {formatUsd(p.unitAmount)}
                    </span>
                    {p.weeklyTiers && (
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>/wk</span>
                    )}
                  </div>
                  {p.weeklyTiers && (
                    <p style={{ fontSize: '0.775rem', color: 'var(--verified-green)', fontWeight: 600, marginBottom: '0.85rem' }}>
                      Buy {p.maxWeeks || 8} weeks at checkout — save up to{' '}
                      {tieredSavingsPct(p, p.maxWeeks || 8)}%
                    </p>
                  )}
                  {p.placementHint && (
                    <p style={{ fontSize: '0.775rem', color: isCategorySponsor ? 'var(--gold-color)' : 'var(--text-secondary)', marginBottom: '1.25rem', fontWeight: 500 }}>
                      📌 {p.placementHint}
                    </p>
                  )}
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
                    {p.benefits.map((b) => (
                      <li key={b} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45, display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                        <Check size={15} color={isCategorySponsor ? 'var(--gold-color)' : 'var(--accent-color)'} style={{ flexShrink: 0, marginTop: '0.2rem' }} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={checkoutHref(p.sku)}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', borderRadius: '10px', fontWeight: 600 }}
                  >
                    Select Boost →
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Feature Comparison Matrix */}
        <div style={{ marginBottom: '4.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>Feature Comparison Matrix</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Compare what is included across every tier and upgrade.</p>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 700 }}>Features & Benefits</th>
                  <th style={{ padding: '1rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>Free Listing</th>
                  <th style={{ padding: '1rem 1rem', textAlign: 'center', color: 'var(--accent-color)', fontWeight: 700 }}>Priority ($5)</th>
                  <th style={{ padding: '1rem 1rem', textAlign: 'center', color: 'var(--accent-color)', fontWeight: 700 }}>Featured ($12/wk)</th>
                  <th style={{ padding: '1rem 1rem', textAlign: 'center', color: 'var(--gold-color)', fontWeight: 700 }}>Category ($18/wk)</th>
                  <th style={{ padding: '1rem 1rem', textAlign: 'center', color: 'var(--accent-color)', fontWeight: 800, background: 'rgba(var(--accent-rgb),0.08)' }}>Premium ($19/mo)</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--text-secondary)' }}>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>Directory Search & Category Indexing</td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center', background: 'rgba(var(--accent-rgb),0.05)' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>Guaranteed &lt; 24h Review Turnaround</td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center', background: 'rgba(var(--accent-rgb),0.05)' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>Homepage Discovery Grid Spotlight</td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center', background: 'rgba(var(--accent-rgb),0.05)' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>Pinned #1 Spot on Category Page</td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center', background: 'rgba(var(--accent-rgb),0.05)' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>Dofollow SEO Website Backlink</td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center', background: 'rgba(var(--accent-rgb),0.05)' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>Live Agent & LLM Access Analytics</td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center', background: 'rgba(var(--accent-rgb),0.05)' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                </tr>
                <tr>
                  <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>Verified Badge & Glowing Card Border</td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><X size={16} color="var(--text-secondary)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                  <td style={{ padding: '0.85rem', textAlign: 'center', background: 'rgba(var(--accent-rgb),0.05)' }}><Check size={18} color="var(--verified-green)" style={{ margin: '0 auto' }} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Step 2 Checkout Selection Component */}
        <PricingClient
          initialServerId={serverId}
          initialCategory={typeof params.category === 'string' ? params.category : ''}
          initialSku={sku}
        />

        {/* Frequently Asked Questions Section */}
        <div style={{ marginTop: '4.5rem', marginBottom: '3rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>Frequently Asked Questions</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Everything you need to know about listing, boosting, and billing on AllMCPs.</p>
          </div>

          <FaqSection
            items={FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a }))}
            defaultOpenIndex={0}
            renderJsonLd={false}
          />
        </div>

        <p style={{ textAlign: 'center', marginTop: '3rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Free forever to list and claim.{' '}
          <Link href="/submit" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
            Submit an MCP Server
          </Link>{' '}
          or{' '}
          <Link href="/browse" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
            Browse the Directory
          </Link>
          .
        </p>
      </main>
    </>
  );
}
