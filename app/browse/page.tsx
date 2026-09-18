import type { Metadata } from 'next';
import { serializeJsonLd } from '@/lib/jsonLd';
import DirectoryGrid from '../../components/DirectoryGrid';
import {
  categoryFromSlug,
  categorySlug,
  normalizeCategory,
  parseCategoryLabel,
} from '../../lib/categories';
import { getCategoryServers, getNewestActiveServers } from '../../lib/servers';

// 5-minute ISR caches default /browse views at the Edge CDN for instant page loads.
export const revalidate = 300;

function resolveCategory(raw: string): string | undefined {
  const fromSlug = categoryFromSlug(raw);
  if (fromSlug) return fromSlug;
  const fromLabel = categoryFromSlug(
    categorySlug(parseCategoryLabel(raw).label),
  );
  if (fromLabel) return fromLabel;
  const normalized = normalizeCategory(raw);
  if (normalized === raw) return normalized;
  return undefined;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const category =
    typeof params.category === 'string' ? params.category : undefined;
  const q = typeof params.q === 'string' ? params.q : undefined;

  const noindex = { robots: { index: false, follow: true } as const };

  if (category) {
    const resolved = resolveCategory(category);
    const slug = resolved ? categorySlug(resolved) : categorySlug(category);
    const label = resolved
      ? parseCategoryLabel(resolved).label
      : parseCategoryLabel(category).label;
    return {
      title: `${label} MCP Servers`,
      description: `Browse Model Context Protocol servers in the ${label} category. Find and install the best AI agent tools on AllMCPs.`,
      alternates: { canonical: `https://allmcps.com/categories/${slug}` },
      ...noindex,
    };
  }

  if (q) {
    return {
      title: `Search: ${q}`,
      description: `MCP servers matching “${q}” on AllMCPs.`,
      alternates: { canonical: 'https://allmcps.com/browse' },
      ...noindex,
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
      type: 'website',
      images: [
        {
          url: 'https://allmcps.com/opengraph-image',
          width: 1200,
          height: 630,
          alt: 'AllMCPs',
        },
      ],
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
  const categoryRaw =
    typeof params.category === 'string' ? params.category : null;
  const q = typeof params.q === 'string' ? params.q : '';
  const category = categoryRaw
    ? resolveCategory(categoryRaw) || categoryRaw
    : null;

  const servers = category
    ? await getCategoryServers(category)
    : await getNewestActiveServers(60);

  const label = category ? parseCategoryLabel(category).label : null;
  const canonical = category
    ? `https://allmcps.com/categories/${categorySlug(category)}`
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
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://allmcps.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Browse',
      item: 'https://allmcps.com/browse',
    },
    ...(label
      ? [{ '@type': 'ListItem', position: 3, name: label, item: canonical }]
      : []),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: label
          ? `${label} MCP Servers`
          : q
            ? `Search results for “${q}”`
            : 'Browse MCP Servers',
        description: label
          ? `Model Context Protocol servers in the ${label} category.`
          : 'Browse and search thousands of Model Context Protocol servers for AI agents.',
        url: canonical,
        isPartOf: {
          '@type': 'WebSite',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
        },
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
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
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
