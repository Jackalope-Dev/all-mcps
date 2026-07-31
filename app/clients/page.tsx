import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { MCP_CLIENTS } from '../../lib/clients';

const SITE = 'https://allmcps.com';

export const metadata: Metadata = {
  title: 'How to Install MCP Servers in Every Client',
  description:
    'Step-by-step setup guides for installing Model Context Protocol (MCP) servers in Claude Desktop, Claude Code, Cursor, Windsurf, and VS Code — config locations, JSON shape, and troubleshooting.',
  alternates: { canonical: `${SITE}/clients` },
  openGraph: {
    title: 'How to Install MCP Servers in Every Client | AllMCPs',
    description:
      'Setup guides for MCP servers in Claude Desktop, Claude Code, Cursor, Windsurf, and VS Code.',
    url: `${SITE}/clients`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Install MCP Servers in Every Client | AllMCPs',
    description: 'Setup guides for MCP servers across every major client.',
  },
};

export default function ClientsIndexPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'How to Install MCP Servers in Every Client',
        description: 'Setup guides for MCP servers across every major client.',
        url: `${SITE}/clients`,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: MCP_CLIENTS.length,
          itemListElement: MCP_CLIENTS.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `How to Install MCP Servers in ${c.name}`,
            url: `${SITE}/clients/${c.slug}`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'MCP Clients', item: `${SITE}/clients` },
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
            <li className="breadcrumb-current">MCP Clients</li>
          </ol>
        </nav>

        <section style={{ marginBottom: '3rem', maxWidth: '760px' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>Install MCP Servers in Any Client</h1>
          <p className="text-lead" style={{ margin: 0 }}>
            Pick your MCP client for a step-by-step setup guide — where the config file lives, the exact
            JSON to add, and how to confirm your tools loaded. Every server in the AllMCPs directory works
            across all of them.
          </p>
        </section>

        <div className="directory-grid">
          {MCP_CLIENTS.map((c) => (
            <Link
              key={c.slug}
              href={`/clients/${c.slug}`}
              className="surface-interactive"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1.5rem', borderRadius: '12px', textDecoration: 'none', color: 'inherit', border: '1px solid var(--border-color)' }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{c.name}</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, flexGrow: 1 }}>{c.lead}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 600 }}>
                View setup guide <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
