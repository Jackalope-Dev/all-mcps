import React from 'react';
import type { Metadata } from 'next';
import { getNewestActiveServers, type Server } from '@/lib/servers';
import { PageShell } from '@/components/PageShell';
import Link from 'next/link';
import { Tag, Sparkles, FolderGit2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Browse MCP Tools by Tag | AllMCPs Directory',
  description:
    'Explore Model Context Protocol (MCP) servers by tag topics including database, web-scraping, finance, github, docker, slack, and more.',
  alternates: {
    canonical: 'https://allmcps.com/tags',
  },
};

function slugifyTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default async function TagsIndexPage() {
  const servers = await getNewestActiveServers(1000);

  const tagCounts = new Map<string, { label: string; count: number }>();

  for (const server of servers) {
    const tags = Array.isArray(server.tags) ? server.tags : [];
    for (const rawTag of tags) {
      if (typeof rawTag !== 'string' || !rawTag.trim()) continue;
      const label = rawTag.trim();
      const slug = slugifyTag(label);
      if (!slug) continue;

      const existing = tagCounts.get(slug);
      if (existing) {
        existing.count += 1;
      } else {
        tagCounts.set(slug, { label, count: 1 });
      }
    }
  }

  const sortedTags = Array.from(tagCounts.entries())
    .map(([slug, data]) => ({ slug, ...data }))
    .sort((a, b) => b.count - a.count);

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
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              color: '#00e5ff',
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
                <Tag size={15} style={{ color: '#00e5ff' }} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  color: '#94a3b8',
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
