import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, ArrowRight, Terminal, BookOpen, Settings } from 'lucide-react';
import { MCP_CLIENTS } from '../../lib/clients';
import { Badge } from '@/components/ui/Badge';

const SITE = 'https://allmcps.com';

export const metadata: Metadata = {
  title: 'How to Install MCP Servers in Every Client',
  description:
    'Step-by-step setup guides for installing MCP servers in Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, and Cline, with config paths and JSON shape.',
  alternates: { canonical: `${SITE}/clients` },
  openGraph: {
    title: 'How to Install MCP Servers in Every Client | AllMCPs',
    description:
      'Setup guides for MCP servers in Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, and Cline.',
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

        <section style={{ marginBottom: '3rem', maxWidth: '760px', margin: '0 auto 3rem', textAlign: 'center' }}>
          <Badge variant="verified" style={{ marginBottom: '1rem' }}>Canonical Setup Guides</Badge>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Install MCP Servers in <span className="text-brand-gradient">Any Client</span>
          </h1>
          <p className="text-lead" style={{ margin: '0 auto' }}>
            Select your preferred AI client below for step-by-step setup guides, OS config file paths, interactive JSON generators, and troubleshooting tips.
          </p>
        </section>

        <ul className="directory-grid" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {MCP_CLIENTS.map((c) => (
            <li key={c.slug}>
            <Link
              href={`/clients/${c.slug}`}
              className="surface-interactive"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '1.5rem',
                borderRadius: '16px',
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--border-color)',
                height: '100%',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Terminal size={18} style={{ color: 'var(--accent-color)' }} />
                  <span>{c.name}</span>
                </h2>
                <Badge variant="category">{c.badgeText}</Badge>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <code style={{ fontSize: '0.75rem', background: 'var(--bg-muted)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--brand-cyan)' }}>
                  {c.configFilename}
                </code>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.55, flexGrow: 1 }}>
                {c.lead}
              </p>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-color)', fontSize: '0.875rem', fontWeight: 600, marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span>View Setup Guide & Config</span>
                <ArrowRight size={15} />
              </span>
            </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
