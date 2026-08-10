import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getNewestActiveServers, type Server } from '@/lib/servers';
import { PageShell } from '@/components/PageShell';
import DirectoryGrid from '@/components/DirectoryGrid';
import { Tag, ChevronRight } from 'lucide-react';

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const servers = await getNewestActiveServers(1000);

  const matched = servers.filter((s) => {
    const tags = Array.isArray(s.tags) ? s.tags : [];
    return tags.some((t) => typeof t === 'string' && slugify(t) === slug);
  });

  if (matched.length === 0) {
    return { title: 'Tag Not Found', robots: { index: false } };
  }

  const rawTag = Array.isArray(matched[0]?.tags)
    ? matched[0].tags.find((t) => typeof t === 'string' && slugify(t) === slug) || slug
    : slug;

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
  const servers = await getNewestActiveServers(1000);

  const matched = servers.filter((s) => {
    const tags = Array.isArray(s.tags) ? s.tags : [];
    return tags.some((t) => typeof t === 'string' && slugify(t) === slug);
  });

  if (matched.length === 0) {
    notFound();
  }

  const rawTag = Array.isArray(matched[0]?.tags)
    ? matched[0].tags.find((t) => typeof t === 'string' && slugify(t) === slug) || slug
    : slug;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
          <Link href="/tags" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Tags
          </Link>
          <ChevronRight size={14} />
          <span style={{ color: '#ffffff' }}>{rawTag}</span>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00e5ff', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <Tag size={16} /> Tag Topic
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            {rawTag} MCP Servers
          </h1>
          <p style={{ fontSize: '1rem', color: '#94a3b8', marginTop: '0.4rem' }}>
            Showing {matched.length} Model Context Protocol tools tagged with &ldquo;{rawTag}&rdquo;.
          </p>
        </div>

        <DirectoryGrid initialServers={matched} variant="browse" />
      </div>
    </PageShell>
  );
}
