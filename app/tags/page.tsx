import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { TagGridClient } from '@/components/TagGridClient';
import { serializeJsonLd } from '@/lib/jsonLd';
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
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="crumbs">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-current="page">Tags</li>
        </ol>
      </nav>

      <header className="dir-page-head animate-in">
        <h1 className="text-page-title">MCP server tags</h1>
        <p className="text-lead">
          {totalTagsCount} topics and integrations. Tags cut across categories —
          use them to find every server that touches a technology.
        </p>
      </header>

      {featuredTags.length > 0 && (
        <section className="dir-trending" aria-labelledby="trending-tags">
          <h2 id="trending-tags" className="dir-trending-title">
            Most used
          </h2>
          <div className="scroll-x fade-x dir-trending-row">
            {featuredTags.map(({ slug, label, count }) => (
              <Link key={slug} href={`/tags/${slug}`} className="chip">
                {label}
                <span className="chip-count">{count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <TagGridClient tags={sortedTags} />
    </PageShell>
  );
}
