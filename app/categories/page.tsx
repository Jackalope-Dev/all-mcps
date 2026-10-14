import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { serializeJsonLd } from '@/lib/jsonLd';
import { CategoryGrid } from '../../components/CategoryGrid';
import { PageHeader, PageShell } from '../../components/PageShell';
import { categorySlug } from '../../lib/categories';
import { getCategoryCounts } from '../../lib/servers';

// Hourly ISR keeps category counts current from D1 without querying on every request.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Browse MCP Servers by Category',
  description:
    'Explore Model Context Protocol servers across 50+ categories. Find AI agent tools for databases, developer workflows, security, and APIs.',
  alternates: {
    canonical: 'https://allmcps.com/categories',
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
    title: 'Browse MCP Servers by Category | AllMCPs',
    description:
      'Explore Model Context Protocol servers across 50+ categories. Find AI agent tools for databases, developer workflows, and security.',
    url: 'https://allmcps.com/categories',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Browse MCP Servers by Category | AllMCPs',
    description:
      'Explore Model Context Protocol servers across 50+ categories. Find AI agent tools for databases, developer workflows, and security.',
  },
};

/**
 * Extract a leading emoji from a category string, if present.
 * Handles multi-codepoint emoji (e.g. 👨‍💻, 🏠) via segmenter where available,
 * and falls back to a broad regex pattern.
 */
function parseEmoji(category: string): { emoji: string; label: string } {
  // Use Intl.Segmenter for robust emoji detection when available
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const segments = segmenter.segment(category);
    const first = segments[Symbol.iterator]().next().value;
    if (first) {
      const char = first.segment;
      // Check if this grapheme cluster looks like an emoji
      const emojiTest = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
      if (emojiTest.test(char)) {
        return { emoji: char, label: category.slice(char.length).trimStart() };
      }
    }
  }
  // Fallback regex for environments without Segmenter
  const emojiRegex =
    /^(\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic}|\uFE0F)*)\s*/u;
  const match = category.match(emojiRegex);
  if (match) {
    return { emoji: match[1], label: category.slice(match[0].length) };
  }
  return { emoji: '', label: category };
}

export default async function CategoriesPage() {
  // One grouped COUNT in D1 (servable listings only) instead of loading every
  // row to count it in the Worker.
  const counts = await getCategoryCounts();

  // Sort by count descending (most popular first)
  const categories = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => {
      const { emoji, label } = parseEmoji(name);
      return { name, emoji, label, count, slug: categorySlug(name) };
    });

  const totalServers = Object.values(counts).reduce((a, b) => a + b, 0);

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'MCP Server Categories',
        description: `Browse ${categories.length} categories of Model Context Protocol servers.`,
        url: 'https://allmcps.com/categories',
        numberOfItems: categories.length,
        isPartOf: {
          '@type': 'WebSite',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: categories.length,
          itemListElement: categories.map((cat, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: cat.label,
            url: `https://allmcps.com/categories/${cat.slug}`,
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
            name: 'Categories',
            item: 'https://allmcps.com/categories',
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <PageShell variant="default">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '2rem' }}>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">Categories</li>
          </ol>
        </nav>

        <PageHeader
          centered
          className="animate-fade-in delay-1"
          title="Browse by Category"
          description={
            <>
              Explore{' '}
              <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                {totalServers.toLocaleString()}
              </span>{' '}
              MCP servers across{' '}
              <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                {categories.length}
              </span>{' '}
              categories.
            </>
          }
        />

        {/* Client-side search + grid */}
        <CategoryGrid categories={categories} />
      </PageShell>
    </>
  );
}
