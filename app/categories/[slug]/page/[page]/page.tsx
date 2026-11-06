import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { HubPagination } from '@/components/directory/HubPagination';
import { ServerRow } from '@/components/directory/ServerRow';
import { ImpressionBeacon } from '@/components/ImpressionTracker';
import {
  categoryFromSlug,
  categorySlug,
  getCategoryMeta,
  parseCategoryLabel,
} from '@/lib/categories';
import { getCategoryPagination } from '@/lib/categoryHub';
import {
  categoryLaterPageIds,
  categoryPageCount,
  hubPagePath,
  parseHubPageParam,
} from '@/lib/categoryPagination';
import { getHubCounts, isCategoryHubIndexable } from '@/lib/hubIndexability';
import { serializeJsonLd } from '@/lib/jsonLd';
import { hydrateServersByIds } from '@/lib/servers';

const SITE = 'https://allmcps.com';

// Same hourly window as page 1 (app/categories/[slug]/page.tsx). Rendered on
// first request, not at build: the page split needs D1's indexable verdicts.
export const revalidate = 3600;

type Params = Promise<{ slug: string; page: string }>;

async function resolve(params: Params) {
  const { slug, page: rawPage } = await params;
  const category = categoryFromSlug(slug);
  const page = parseHubPageParam(rawPage);
  if (!category || page === null) return null;
  return { slug, category, page, canonicalSlug: categorySlug(category) };
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return { title: 'Page Not Found', robots: { index: false } };
  const { label } = parseCategoryLabel(r.category);
  const title = `${label} MCP Servers - Page ${r.page}`;
  const description = `Page ${r.page} of the ${label} Model Context Protocol (MCP) servers on AllMCPs, ranked by usage. Compare tools and install them in Claude, Cursor and more.`;
  const url = `${SITE}${hubPagePath(`/categories/${r.canonicalSlug}`, r.page)}`;
  const indexable = isCategoryHubIndexable(r.category, await getHubCounts());
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: { title: `${title} | AllMCPs`, description, url },
  };
}

export default async function CategoryHubPage({ params }: { params: Params }) {
  const r = await resolve(params);
  if (!r) notFound();
  const { category, page, canonicalSlug } = r;
  if (r.slug !== canonicalSlug) {
    permanentRedirect(hubPagePath(`/categories/${canonicalSlug}`, page));
  }

  const pagination = await getCategoryPagination(category);
  const ids = pagination ? categoryLaterPageIds(pagination, page) : [];
  if (!pagination || ids.length === 0) notFound();
  const servers = await hydrateServersByIds(ids);
  if (servers.length === 0) notFound();

  const pageCount = categoryPageCount(pagination);
  const { label } = parseCategoryLabel(category);
  const meta = getCategoryMeta(category);
  const base = `/categories/${canonicalSlug}`;
  const url = `${SITE}${hubPagePath(base, page)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${label} MCP Servers - Page ${page}`,
        url,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
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
            name: 'Categories',
            item: `${SITE}/categories`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: label,
            item: `${SITE}${base}`,
          },
          { '@type': 'ListItem', position: 4, name: `Page ${page}`, item: url },
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
      <main className="container dir-catpage">
        <nav aria-label="Breadcrumb">
          <ol className="crumbs">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/categories">Categories</Link>
            </li>
            <li>
              <Link href={base}>{label}</Link>
            </li>
            <li aria-current="page">Page {page}</li>
          </ol>
        </nav>

        <header className={`dir-hero animate-in hue-${meta.hue}`}>
          <span className="dir-hero-icon" aria-hidden="true">
            {meta.emoji}
          </span>
          <div className="dir-hero-body">
            <h1 className="text-page-title">
              {label} MCP servers, page {page}
            </h1>
            <p className="dir-hero-lead">
              More {label} Model Context Protocol servers, continued from{' '}
              <Link href={base}>the top {label} picks</Link>. Every server here
              has our own writeup and real-world usage. Page {page} of{' '}
              {pageCount}.
            </p>
          </div>
        </header>

        <section className="dir-section" aria-labelledby="page-servers">
          <h2 id="page-servers" className="sr-only">
            {label} servers, page {page}
          </h2>
          <ol className="dir-list dir-list--plain">
            {servers.map((server) => (
              <li key={server.id}>
                <ImpressionBeacon serverId={server.id} surface="category_page">
                  <ServerRow server={server} hideCategory />
                </ImpressionBeacon>
              </li>
            ))}
          </ol>
          <div className="dir-more">
            <HubPagination
              base={base}
              page={page}
              pageCount={pageCount}
              label={`${label} servers`}
            />
          </div>
        </section>
      </main>
    </>
  );
}
