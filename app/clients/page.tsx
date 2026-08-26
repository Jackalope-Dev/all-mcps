import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, ArrowRight, Terminal, BookOpen, Settings } from 'lucide-react';
import { MCP_CLIENTS } from '@/lib/clients';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageShell';

const SITE = 'https://allmcps.com';

export const metadata: Metadata = {
  title: 'How to Install MCP Servers in Every Client',
  description:
    'Step-by-step setup guides for installing MCP servers in Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, and Cline, with config paths and JSON shape.',
  alternates: { canonical: `${SITE}/clients` },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
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
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'MCP Clients', item: `${SITE}/clients` },
        ],
      },
    ],
  };

  return (
    <PageShell variant="default">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
          <ol className="breadcrumb">
            <li><Link href="/">Home</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">MCP Clients</li>
          </ol>
        </nav>

        <PageHeader
          centered
          badge={<Badge variant="verified"><Settings size={13} style={{ marginRight: '0.35rem' }} /> Canonical Setup Guides</Badge>}
          title={<>Install MCP Servers in <span className="text-brand-gradient">Any Client</span></>}
          description="Select your preferred AI client below for step-by-step setup guides, OS config file paths, interactive JSON generators, and troubleshooting tips."
        />

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '2.5rem 0 0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {MCP_CLIENTS.map((c) => (
            <li key={c.slug}>
              <Card
                href={`/clients/${c.slug}`}
                hoverable
                glow
                crosshair
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.5rem',
                  height: '100%',
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

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-color)', fontSize: '0.875rem', fontWeight: 600, marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span>View Setup Guide &amp; Config</span>
                  <ArrowRight size={15} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
