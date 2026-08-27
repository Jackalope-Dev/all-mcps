import { ChevronRight, Flame, Hash, Layers, Sparkles, Tag } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { TagGridClient } from '@/components/TagGridClient';
import { getAllTagsWithCounts } from '@/lib/tags';

export const metadata: Metadata = {
  title: 'Browse MCP Tools by Tag',
  description:
    'Explore Model Context Protocol (MCP) servers by tag topics including database, web-scraping, finance, github, docker, slack, and more.',
  alternates: {
    canonical: 'https://allmcps.com/tags',
  },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Browse MCP Tools by Tag | AllMCPs Directory',
    description:
      'Explore Model Context Protocol (MCP) servers by tag topics including database, web-scraping, finance, github, docker, slack, and more.',
    url: 'https://allmcps.com/tags',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Browse MCP Tools by Tag | AllMCPs Directory',
    description:
      'Explore Model Context Protocol (MCP) servers by tag topics including database, web-scraping, finance, github, docker, slack, and more.',
  },
};

export default async function TagsIndexPage() {
  const sortedTags = await getAllTagsWithCounts();

  // Compute metrics
  const totalTagsCount = sortedTags.length;
  const totalTaggedRefs = sortedTags.reduce((sum, t) => sum + t.count, 0);
  const topTag = sortedTags[0]
    ? sortedTags[0]
    : { label: 'Developer', count: 0 };
  const featuredTags = sortedTags.slice(0, 10);

  // Structured JSON-LD Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'MCP Server Tags & Topics Index',
        description: `Browse ${totalTagsCount} tag topics and capabilities across the Model Context Protocol ecosystem.`,
        url: 'https://allmcps.com/tags',
        numberOfItems: totalTagsCount,
        isPartOf: {
          '@type': 'WebSite',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: Math.min(totalTagsCount, 50),
          itemListElement: sortedTags.slice(0, 50).map((tag, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: tag.label,
            url: `https://allmcps.com/tags/${tag.slug}`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://allmcps.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Tags',
            item: 'https://allmcps.com/tags',
          },
        ],
      },
    ],
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="tags-container">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
          <ol className="breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">Tags</li>
          </ol>
        </nav>

        {/* Hero Section */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '2.5rem',
            maxWidth: '750px',
            margin: '0 auto 2.5rem',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              backgroundColor:
                'color-mix(in srgb, var(--accent-color) 12%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--accent-color) 30%, transparent)',
              color: 'var(--accent-color)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            <Tag size={14} /> Taxonomy Index
          </div>
          <h1 className="text-display" style={{ marginBottom: '0.85rem' }}>
            MCP Directory Tags
          </h1>
          <p
            className="text-lead"
            style={{ margin: '0 auto', textAlign: 'center' }}
          >
            Browse{' '}
            <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
              {totalTagsCount}
            </span>{' '}
            topics and integrations across the Model Context Protocol ecosystem.
          </p>
        </div>

        {/* Summary Metric Cards */}
        <div className="tags-stats-grid">
          <div className="tags-stat-card">
            <div className="tags-stat-icon">
              <Hash size={22} />
            </div>
            <div>
              <div className="tags-stat-val">{totalTagsCount}</div>
              <div className="tags-stat-lbl">Total Topics & Tags</div>
            </div>
          </div>

          <div className="tags-stat-card">
            <div className="tags-stat-icon">
              <Layers size={22} />
            </div>
            <div>
              <div className="tags-stat-val">
                {totalTaggedRefs.toLocaleString()}
              </div>
              <div className="tags-stat-lbl">Tagged Server References</div>
            </div>
          </div>

          <div className="tags-stat-card">
            <div className="tags-stat-icon">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="tags-stat-val">{topTag.label}</div>
              <div className="tags-stat-lbl">
                Most Popular ({topTag.count} servers)
              </div>
            </div>
          </div>
        </div>

        {/* Featured Tags Section */}
        {featuredTags.length > 0 && (
          <div className="featured-tags-section">
            <div className="featured-tags-header">
              <Flame size={16} /> Featured & Trending Topics
            </div>
            <div className="featured-tags-pills">
              {featuredTags.map(({ slug, label, count }) => (
                <Link
                  key={slug}
                  href={`/tags/${slug}`}
                  className="featured-tag-pill"
                >
                  <span>{label}</span>
                  <span className="featured-tag-count">{count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Client-side Search, Filter & Tag Grid */}
        <TagGridClient tags={sortedTags} />
      </div>
    </PageShell>
  );
}
