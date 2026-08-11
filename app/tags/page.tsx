import React from 'react';
import type { Metadata } from 'next';
import { getAllTagsWithCounts } from '@/lib/tags';
import { PageShell } from '@/components/PageShell';
import Link from 'next/link';
import { Tag } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Browse MCP Tools by Tag | AllMCPs Directory',
  description:
    'Explore Model Context Protocol (MCP) servers by tag topics including database, web-scraping, finance, github, docker, slack, and more.',
  alternates: {
    canonical: 'https://allmcps.com/tags',
  },
};

export default async function TagsIndexPage() {
  const sortedTags = await getAllTagsWithCounts();

  return (
    <PageShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2.5rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              backgroundColor: 'color-mix(in srgb, var(--accent-color) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-color) 30%, transparent)',
              color: 'var(--accent-color)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            <Tag size={14} /> Taxonomy Index
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            MCP Directory Tags
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Browse {sortedTags.length} topics and capabilities across the Model Context Protocol ecosystem.
          </p>
        </div>

        {/* Tag Cloud */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.85rem' }}>
          {sortedTags.map(({ slug, label, count }) => (
            <Link
              key={slug}
              href={`/tags/${slug}`}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tag size={15} style={{ color: 'var(--accent-color)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-muted)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  color: 'var(--text-secondary)',
                }}
              >
                {count}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
