import { Hash } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HubPagination } from '@/components/directory/HubPagination';
import { ServerRow } from '@/components/directory/ServerRow';
import { ImpressionBeacon } from '@/components/ImpressionTracker';
import { PageShell } from '@/components/PageShell';
import { hubPagePath, parseHubPageParam } from '@/lib/categoryPagination';
import { serializeJsonLd } from '@/lib/jsonLd';
import { getServersForTag } from '@/lib/tags';

const SITE = 'https://allmcps.com';

// Same window and data source as page 1 (app/tags/[slug]/page.tsx).
export const revalidate = 3600;

type Params = Promise<{ slug: string; page: string }>;

async function load(params: Params) {
  const { slug, page: rawPage } = await params;
  const page = parseHubPageParam(rawPage);
  if (page === null) return null;
  const data = await getServersForTag(slug, page);
  if (data.total === 0 || data.servers.length === 0) return null;
  return { slug, page, ...data };
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const r = await load(params);
  if (!r) return { title: 'Page Not Found', robots: { index: false } };
  const title = `${r.rawTag} MCP Servers & Tools - Page ${r.page}`;
  const description = `Page ${r.page} of the ${r.total} Model Context Protocol (MCP) servers tagged ${r.rawTag} on AllMCPs, ranked by usage.`;
  const url = `${SITE}${hubPagePath(`/tags/${r.slug}`, r.page)}`;
  return {
    title,
    description,
    // Same rule as page 1 and the core sitemap (lib/tags.ts isTagIndexable).
    ...(!r.indexable ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: url },
    openGraph: { title: `${title} | AllMCPs`, description, url },
  };
}

export default async function TagHubPage({ params }: { params: Params }) {
  const r = await load(params);
  if (!r) notFound();
  const { slug, page, servers, total, pageCount, rawTag } = r;
  const base = `/tags/${slug}`;
  const url = `${SITE}${hubPagePath(base, page)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${rawTag} MCP Servers & Tools - Page ${page}`,
        url,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: total,
          itemListElement: servers.map((s, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE}/mcp/${s.id}`,
            name: s.name,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Tags',
            item: `${SITE}/tags`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: rawTag,
            item: `${SITE}${base}`,
          },
          { '@type': 'ListItem', position: 4, name: `Page ${page}`, item: url },
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
          <li>
            <Link href={base}>{rawTag}</Link>
          </li>
          <li aria-current="page">Page {page}</li>
        </ol>
      </nav>

      <header className="dir-hero animate-in">
        <span className="dir-hero-icon" aria-hidden="true">
          <Hash size={24} />
        </span>
        <div className="dir-hero-body">
          <h1 className="text-page-title">
            {rawTag} MCP servers &amp; tools, page {page}
          </h1>
          <p className="dir-hero-lead">
            More of the {total.toLocaleString()} servers tagged &ldquo;{rawTag}
            &rdquo;, continued from{' '}
            <Link href={base}>the top {rawTag} picks</Link>. Page {page} of{' '}
            {pageCount}, ranked by usage.
          </p>
        </div>
      </header>

      <h2 className="sr-only">
        Servers tagged {rawTag}, page {page}
      </h2>
      <ol className="dir-list dir-list--plain">
        {servers.map((server) => (
          <li key={server.id}>
            <ImpressionBeacon serverId={server.id} surface="browse_list">
              <ServerRow server={server} />
            </ImpressionBeacon>
          </li>
        ))}
      </ol>
      <div className="dir-more">
        <HubPagination
          base={base}
          page={page}
          pageCount={pageCount}
          label={`${rawTag} servers`}
        />
      </div>
    </PageShell>
  );
}
