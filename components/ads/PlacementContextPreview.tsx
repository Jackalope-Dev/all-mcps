'use client';

import React from 'react';
import { SponsorAdUnit } from './SponsorAdUnit';
import type { SponsorAd } from '@/lib/ads';

// ─── Fake listing card data ───────────────────────────────────────────────────

const FAKE_LISTINGS = [
  {
    name: 'Example Git MCP',
    org: 'example',
    desc: 'Search repositories, read files, create issues, and manage pull requests through a Git hosting API from any MCP client.',
    tags: ['Developer Tools', 'Git'],
    stars: 4.8,
  },
  {
    name: 'Example Database MCP',
    org: 'example',
    desc: 'Execute SQL queries, inspect schemas, and manage databases directly from Claude or Cursor.',
    tags: ['Database', 'SQL'],
    stars: 4.6,
  },
  {
    name: 'Example Search MCP',
    org: 'example',
    desc: 'Real-time internet search with full-page extraction, summarization, and structured result parsing for AI agents.',
    tags: ['Search', 'Web'],
    stars: 4.9,
  },
  {
    name: 'Example Design MCP',
    org: 'example',
    desc: 'Read design tokens, component specs, and layout data to accelerate design-to-code workflows.',
    tags: ['Design', 'UI'],
    stars: 4.5,
  },
  {
    name: 'Example Payments MCP',
    org: 'example',
    desc: 'Query balances, list transactions, create payment links, and manage subscriptions via a payments API.',
    tags: ['Payments', 'Finance'],
    stars: 4.7,
  },
];

// ─── Shared mock card ─────────────────────────────────────────────────────────

function MockListingCard({ listing }: { listing: (typeof FAKE_LISTINGS)[0] }) {
  return (
    <div
      className="surface"
      style={{
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '180px',
        opacity: 0.72,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
        {/* Avatar */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--text-secondary)',
          }}
        >
          {listing.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {listing.name}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>by {listing.org}</div>
        </div>
      </div>
      {/* Description */}
      <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: '0 0 0.6rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {listing.desc}
      </p>
      {/* Tags */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: 'auto' }}>
        {listing.tags.map((t) => (
          <span key={t} style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Context label ────────────────────────────────────────────────────────────

function ContextLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.68rem',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span style={{ width: '18px', height: '2px', background: 'var(--border-color)', display: 'inline-block', borderRadius: '2px' }} />
      {children}
      <span style={{ flex: 1, height: '2px', background: 'var(--border-color)', display: 'inline-block', borderRadius: '2px' }} />
    </div>
  );
}

// ─── Individual placement frames ──────────────────────────────────────────────

/** directory_inline — 3-col mini grid with ad slotted in at position 1 (0-indexed) */
function DirectoryInlineFrame({ previewAd }: { previewAd: Partial<SponsorAd> }) {
  const cols = [FAKE_LISTINGS[0], null, FAKE_LISTINGS[1], FAKE_LISTINGS[2]];
  return (
    <div>
      <ContextLabel>Browse / Category page · inside listing grid</ContextLabel>
      <div className="placement-preview-grid-3">
        {cols.map((listing, i) =>
          listing === null ? (
            <SponsorAdUnit key="ad" placement="directory_inline" previewAd={previewAd} />
          ) : (
            <MockListingCard key={i} listing={listing} />
          )
        )}
      </div>
    </div>
  );
}

/** detail_sidebar — realistic MCP server detail page on left, ad in right sidebar */
function DetailSidebarFrame({ previewAd }: { previewAd: Partial<SponsorAd> }) {
  return (
    <div>
      <ContextLabel>Server detail page · right-hand sidebar</ContextLabel>
      <div className="placement-preview-sidebar">
        {/* Main content mock */}
        <div
          className="surface"
          style={{
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            padding: '1.25rem',
            opacity: 0.82,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
              }}
            >
              EX
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Example Database MCP</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>by example · ★ 4.6 · 12.3k installs</div>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem' }}>
            Execute SQL queries, inspect schemas, and manage databases directly from Claude, Cursor, or Windsurf. Supports read-only and read-write modes with configurable connection strings.
          </p>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Quick Install
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '0.55rem 0.7rem',
              marginBottom: '1rem',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            npx -y @example/database-mcp
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ height: '30px', padding: '0 0.85rem', display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Add to Claude
            </div>
            <div style={{ height: '30px', padding: '0 0.85rem', display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              View Source
            </div>
          </div>
        </div>
        {/* Ad in sidebar */}
        <SponsorAdUnit placement="detail_sidebar" previewAd={previewAd} />
      </div>
    </div>
  );
}

/** header_banner — realistic category page structure with ad below the header */
function HeaderBannerFrame({ previewAd }: { previewAd: Partial<SponsorAd> }) {
  return (
    <div>
      <ContextLabel>Category hub page · below the category header</ContextLabel>
      {/* Realistic page header */}
      <div
        style={{
          textAlign: 'center',
          padding: '1.5rem 1rem 1.25rem',
          marginBottom: '1rem',
          opacity: 0.78,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            margin: '0 auto 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
          }}
        >
          🗄️
        </div>
        <h4 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>
          Database MCP Servers
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 auto', maxWidth: '420px', lineHeight: 1.5 }}>
          Browse and install the best Database MCP servers for AI agents. Compare tools, view install commands, and connect Claude, Cursor, and more.
        </p>
      </div>
      {/* Real ad */}
      <SponsorAdUnit placement="header_banner" previewAd={previewAd} />
      {/* Hint of grid below */}
      <div className="placement-preview-grid-3" style={{ marginTop: '0.75rem', opacity: 0.5, pointerEvents: 'none' }}>
        {FAKE_LISTINGS.slice(0, 3).map((l, i) => (
          <MockListingCard key={i} listing={l} />
        ))}
      </div>
    </div>
  );
}

/** blog_guide — placeholder-bar article shell (real prose here reads too easily as an actual post) with ad embedded mid-content */
function BlogGuideFrame({ previewAd }: { previewAd: Partial<SponsorAd> }) {
  return (
    <div>
      <ContextLabel>Blog / Guide article · embedded mid-content</ContextLabel>
      {/* Fake article top */}
      <div style={{ opacity: 0.6, pointerEvents: 'none', userSelect: 'none', marginBottom: '1rem' }}>
        <div style={{ width: '70%', height: '20px', background: 'var(--border-strong)', borderRadius: '5px', marginBottom: '0.85rem' }} />
        {[100, 94, 88, 97, 80].map((w, i) => (
          <div key={i} style={{ height: '10px', background: 'var(--border-strong)', borderRadius: '4px', marginBottom: '8px', width: `${w}%` }} />
        ))}
        <div style={{ width: '55%', height: '16px', background: 'var(--border-strong)', borderRadius: '5px', margin: '1rem 0 0.75rem' }} />
        {[100, 92, 85].map((w, i) => (
          <div key={i} style={{ height: '10px', background: 'var(--border-strong)', borderRadius: '4px', marginBottom: '8px', width: `${w}%` }} />
        ))}
      </div>
      {/* Real ad */}
      <SponsorAdUnit placement="blog_guide" previewAd={previewAd} />
      {/* Fake article bottom */}
      <div style={{ opacity: 0.35, pointerEvents: 'none', userSelect: 'none', marginTop: '1rem' }}>
        {[100, 90, 78].map((w, i) => (
          <div key={i} style={{ height: '10px', background: 'var(--border-strong)', borderRadius: '4px', marginBottom: '8px', width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export type PlacementFrameType = 'directory_inline' | 'detail_sidebar' | 'header_banner' | 'blog_guide';

interface PlacementContextPreviewProps {
  placement: PlacementFrameType;
  previewAd: Partial<SponsorAd>;
}

export function PlacementContextPreview({ placement, previewAd }: PlacementContextPreviewProps) {
  switch (placement) {
    case 'directory_inline': return <DirectoryInlineFrame previewAd={previewAd} />;
    case 'detail_sidebar':   return <DetailSidebarFrame previewAd={previewAd} />;
    case 'header_banner':    return <HeaderBannerFrame previewAd={previewAd} />;
    case 'blog_guide':       return <BlogGuideFrame previewAd={previewAd} />;
  }
}
