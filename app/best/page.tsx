import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { BEST_TOPICS, CATEGORY_TOPICS, KEYWORD_TOPICS } from '../../lib/bestTopics';

const SITE = 'https://allmcps.com';

export const metadata: Metadata = {
  title: 'Best MCP Servers by Use Case',
  description:
    'Curated, ranked guides to the best Model Context Protocol (MCP) servers for databases, developers, web search, security, browser automation, and more.',
  alternates: { canonical: `${SITE}/best` },
  openGraph: {
    title: 'Best MCP Servers by Use Case | AllMCPs',
    description:
      'Curated, ranked guides to the best MCP servers for databases, developers, web search, security, browser automation, and more.',
    url: `${SITE}/best`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best MCP Servers by Use Case | AllMCPs',
    description: 'Curated, ranked guides to the best MCP servers for every use case.',
  },
};

export default function BestIndexPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Best MCP Servers by Use Case',
        description: 'Curated, ranked guides to the best MCP servers for every use case.',
        url: `${SITE}/best`,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: BEST_TOPICS.length,
          itemListElement: BEST_TOPICS.map((t, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `Best MCP Servers for ${t.title}`,
            url: `${SITE}/best/${t.slug}`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Best MCP Servers', item: `${SITE}/best` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container page-shell" style={{ paddingBottom: '4rem' }}>
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '2rem' }}>
            <li><Link href="/">Home</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">Best MCP Servers</li>
          </ol>
        </nav>

        <section style={{ marginBottom: '3rem', maxWidth: '760px' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>Best MCP Servers by Use Case</h1>
          <p className="text-lead" style={{ margin: 0 }}>
            Hand-picked, usage-ranked guides to the best Model Context Protocol servers for the jobs
            people reach for most — each list is drawn live from the AllMCPs directory.
          </p>
        </section>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 1.25rem' }}>By use case</h2>
        <div className="directory-grid">
          {CATEGORY_TOPICS.map((t) => (
            <Link
              key={t.slug}
              href={`/best/${t.slug}`}
              className="surface-interactive"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1.5rem', borderRadius: '12px', textDecoration: 'none', color: 'inherit', border: '1px solid var(--border-color)' }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Best for {t.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, flexGrow: 1 }}>{t.lead}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 600 }}>
                View ranking <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>

        <section style={{ marginTop: '3.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.5rem' }}>By integration</h2>
          <p className="text-lead" style={{ margin: '0 0 1.5rem', fontSize: '1rem', maxWidth: '760px' }}>
            Looking for a specific tool? Jump straight to the best MCP servers for the platforms and
            databases people connect most.
          </p>
          <div className="directory-grid">
            {KEYWORD_TOPICS.map((t) => (
              <Link
                key={t.slug}
                href={`/best/${t.slug}`}
                className="surface-interactive"
                style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1.5rem', borderRadius: '12px', textDecoration: 'none', color: 'inherit', border: '1px solid var(--border-color)' }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Best {t.title} MCP servers</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, flexGrow: 1 }}>{t.lead}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 600 }}>
                  View ranking <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
