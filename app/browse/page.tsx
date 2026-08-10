import DirectoryGrid from '../../components/DirectoryGrid';
import type { Metadata } from 'next';
import { getCategoryServers, getNewestActiveServers } from '../../lib/servers';

function parseCategoryLabel(category: string): string {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const first = segmenter.segment(category)[Symbol.iterator]().next().value;
    if (first) {
      const char = first.segment;
      if (/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(char)) {
        return category.slice(char.length).trimStart();
      }
    }
  }
  const match = category.match(/^(\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic}|\uFE0F)*)\s*/u);
  if (match) return category.slice(match[0].length);
  return category;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const category = typeof params.category === 'string' ? params.category : undefined;
  const q = typeof params.q === 'string' ? params.q : undefined;

  if (category) {
    const label = parseCategoryLabel(category);
    return {
      title: `${label} MCP Servers`,
      description: `Browse Model Context Protocol servers in the ${label} category. Find and install the best AI agent tools on AllMCPs.`,
      alternates: {
        canonical: `https://allmcps.com/browse?category=${encodeURIComponent(category)}`,
      },
    };
  }

  if (q) {
    return {
      title: `Search: ${q}`,
      description: `MCP servers matching “${q}” on AllMCPs.`,
      alternates: {
        canonical: `https://allmcps.com/browse?q=${encodeURIComponent(q)}`,
      },
    };
  }

  return {
    title: 'Browse MCP Servers',
    description:
      'Browse and search thousands of Model Context Protocol servers. Filter by category, sort by trending or newest, and find the right tools for your AI agents.',
    alternates: {
      canonical: 'https://allmcps.com/browse',
    },
    openGraph: {
      title: 'Browse MCP Servers | AllMCPs',
      description:
        'Browse and search thousands of Model Context Protocol servers. Filter by category, sort by trending or newest.',
      url: 'https://allmcps.com/browse',
    },
  };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const category = typeof params.category === 'string' ? params.category : null;
  const q = typeof params.q === 'string' ? params.q : '';

  const servers = category ? await getCategoryServers(category) : await getNewestActiveServers(60);

  // Structured data reflects the server-rendered initial state. For category
  // views we filter to the matching servers so the ItemList is accurate; search
  // ranking happens client-side, so we omit the ItemList there rather than
  // misrepresent it.
  const label = category ? parseCategoryLabel(category) : null;
  const canonical = category
    ? `https://allmcps.com/browse?category=${encodeURIComponent(category)}`
    : q
      ? `https://allmcps.com/browse?q=${encodeURIComponent(q)}`
      : 'https://allmcps.com/browse';
  const relevant = servers;

  // Server-render only a small slice for fast HTML + SEO; DirectoryGrid fetches the
  // full catalog from /api/directory-feed on mount so search/sort/filter cover
  // everything. Previously the entire catalog was inlined into the browse HTML.
  const initialForGrid = relevant.slice(0, 60);

  const itemList = q
    ? []
    : relevant.slice(0, 50).map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://allmcps.com/mcp/${s.id}`,
        name: s.name,
      }));

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
    { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://allmcps.com/browse' },
    ...(label ? [{ '@type': 'ListItem', position: 3, name: label, item: canonical }] : []),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: label ? `${label} MCP Servers` : q ? `Search results for “${q}”` : 'Browse MCP Servers',
        description: label
          ? `Model Context Protocol servers in the ${label} category.`
          : 'Browse and search thousands of Model Context Protocol servers for AI agents.',
        url: canonical,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: 'https://allmcps.com' },
        ...(itemList.length
          ? {
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: relevant.length,
                itemListElement: itemList,
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DirectoryGrid
        initialServers={initialForGrid}
        initialCategory={category}
        initialQuery={q}
        variant="browse"
        lazyFeedUrl="/api/directory-feed"
      />
    </main>
  );
}
