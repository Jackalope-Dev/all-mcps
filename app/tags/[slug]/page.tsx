import { Hash, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ServerRow } from '@/components/directory/ServerRow';
import { ImpressionBeacon } from '@/components/ImpressionTracker';
import { PageShell } from '@/components/PageShell';
import { serializeJsonLd } from '@/lib/jsonLd';
import { getServersForTag } from '@/lib/tags';

// getServersForTag reads the shared tag index (lib/tags.ts: one catalog walk,
// cached per colo and in R2) and loads only the rows shown. ISR + the R2-backed
// incrementalCache (open-next.config.ts) let the page persist across requests
// like the other listing pages (categories/[slug], best/[topic]).
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { total, rawTag, indexable } = await getServersForTag(slug);

  if (total === 0) {
    return { title: 'Tag Not Found', robots: { index: false } };
  }

  const title = `${rawTag} MCP Servers & Tools`;
  const description = `Browse ${total} Model Context Protocol (MCP) servers tagged with ${rawTag}. Find and install AI tools for ${rawTag}.`;
  const url = `https://allmcps.com/tags/${slug}`;

  // Same rule as the core sitemap (lib/tags.ts isTagIndexable), so we never
  // submit a tag page that noindexes itself.
  return {
    title,
    description,
    ...(!indexable ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: url },
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
      title: `${title} | AllMCPs`,
      description,
      url,
    },
  };
}

export default async function TagDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // `shown` is already the top rows by engagementScore, best first.
  const { servers: shown, total, rawTag } = await getServersForTag(slug);

  if (total === 0) {
    notFound();
  }

  const canonicalUrl = `https://allmcps.com/tags/${slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${rawTag} MCP Servers & Tools`,
        description: `Explore ${total} Model Context Protocol (MCP) servers and tools tagged with ${rawTag}.`,
        url: canonicalUrl,
        isPartOf: {
          '@type': 'WebSite',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: total,
          itemListElement: shown.slice(0, 50).map((s, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `https://allmcps.com/mcp/${s.id}`,
            name: s.name,
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
          {
            '@type': 'ListItem',
            position: 3,
            name: rawTag,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="crumbs">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/tags">Tags</Link>
          </li>
          <li aria-current="page">{rawTag}</li>
        </ol>
      </nav>

      <header className="dir-hero animate-in">
        <span className="dir-hero-icon" aria-hidden="true">
          <Hash size={24} />
        </span>
        <div className="dir-hero-body">
          <h1 className="text-page-title">{rawTag} MCP servers &amp; tools</h1>
          <p className="dir-hero-lead">
            {total.toLocaleString()} Model Context Protocol servers tagged
            &ldquo;{rawTag}&rdquo;, ranked by usage. Connect any of them to
            Claude Desktop, Cursor or Windsurf in one step.
          </p>
          <div className="dir-hero-actions">
            <Link
              href={`/browse?q=${encodeURIComponent(rawTag)}`}
              className="btn btn-secondary btn-md"
              rel="nofollow"
            >
              <Search size={15} aria-hidden="true" />
              Search &ldquo;{rawTag}&rdquo; with filters
            </Link>
          </div>
        </div>
      </header>

      <h2 className="sr-only">Servers tagged {rawTag}</h2>
      <ol className="dir-list dir-list--plain">
        {shown.map((server) => (
          <li key={server.id}>
            <ImpressionBeacon serverId={server.id} surface="browse_list">
              <ServerRow server={server} />
            </ImpressionBeacon>
          </li>
        ))}
      </ol>
      {total > shown.length && (
        <div className="dir-more">
          <span className="dir-more-meta tabular">
            Showing {shown.length} of {total.toLocaleString()}
          </span>
          <Link
            href={`/browse?q=${encodeURIComponent(rawTag)}`}
            className="btn btn-secondary btn-md"
            rel="nofollow"
          >
            See all in Browse
          </Link>
        </div>
      )}
    </PageShell>
  );
}
