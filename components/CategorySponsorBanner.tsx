'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Crown } from 'lucide-react';

interface CategorySponsorBannerProps {
  categoryName: string;
}

export function CategorySponsorBanner({ categoryName }: CategorySponsorBannerProps) {
  return (
    <div
      className="surface"
      style={{
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        border: '1px solid rgba(0, 229, 255, 0.3)',
        background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 123, 255, 0.04) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(0, 229, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00E5FF',
            flexShrink: 0,
          }}
        >
          <Crown size={20} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#00E5FF' }}>
              Category Sponsorship Available
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
            Sponsor {categoryName} on AllMCPs
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0', lineHeight: 1.4 }}>
            Get your MCP server pinned at the top of this category &amp; featured in category searches.
          </p>
        </div>
      </div>

      <Link
        href="/pricing#premium"
        className="btn btn-sm btn-primary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
      >
        <Sparkles size={14} /> Sponsor This Category →
      </Link>
    </div>
  );
}
