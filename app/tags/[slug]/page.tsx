import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServersForTag } from '@/lib/tags';
import { PageShell } from '@/components/PageShell';
import DirectoryGrid from '@/components/DirectoryGrid';
import { Tag, ChevronRight } from 'lucide-react';

// getServersForTag re-derives tags for the whole active catalog via regex extraction
// (see lib/tags.ts) — expensive to re-run on every request. ISR + the R2-backed
// incrementalCache (open-next.config.ts) let this persist across requests like the
// other listing pages (categories/[slug], best/[topic]).
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { servers: matched, rawTag } = await getServersForTag(slug);

  if (matched.length === 0) {
    return { title: 'Tag Not Found', robots: { index: false } };
  }

  return {
    title: `${rawTag} MCP Servers & Tools | AllMCPs`,
    description: `Browse ${matched.length} Model Context Protocol (MCP) servers tagged with ${rawTag}. Find and install AI tools for ${rawTag}.`,
    alternates: {
      canonical: `https://allmcps.com/tags/${slug}`,
    },
  };
}

export default async function TagDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { servers: matched, rawTag } = await getServersForTag(slug);

  if (matched.length === 0) {
    notFound();
  }

  const itemList = matched.slice(0, 50).map((s, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `https://allmcps.com/mcp/${s.id}`,
    name: s.name,
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${rawTag} MCP Servers`,
    numberOfItems: matched.length,
    itemListElement: itemList,
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          <Link href="/tags" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Tags
          </Link>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-primary)' }}>{rawTag}</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2.5rem', maxWidth: '700px', margin: '0 auto 2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <Tag size={16} /> Tag Topic
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {rawTag} MCP Servers
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
            Showing {matched.length} Model Context Protocol tools tagged with &ldquo;{rawTag}&rdquo;.
          </p>
        </div>

        <DirectoryGrid initialServers={matched} variant="browse" />
      </div>
    </PageShell>
  );
}
