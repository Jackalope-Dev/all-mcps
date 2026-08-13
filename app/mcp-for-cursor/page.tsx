import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import { getCuratedStarterServers } from '@/lib/servers';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ServerAvatar } from '@/components/ui/ServerAvatar';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { parseServerName } from '@/lib/displayName';
import { mcpClientBySlug } from '@/lib/clients';
import { ClientConfigSection } from '@/components/clients/ClientConfigSection';
import { ServerConfigCopyButton } from '@/components/clients/ServerConfigCopyButton';

export const metadata: Metadata = {
  title: 'Top MCP Servers for Cursor IDE — Setup Guide',
  description:
    'Discover top Model Context Protocol (MCP) tools for Cursor IDE. Interactive setup guide for Cursor MCP server configurations on macOS and Windows.',
  alternates: { canonical: 'https://allmcps.com/mcp-for-cursor' },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
    title: 'Top MCP Servers for Cursor | AllMCPs',
    description:
      'Connect Cursor AI editor to databases, APIs, and custom agent tools over MCP.',
    url: 'https://allmcps.com/mcp-for-cursor',
  },
};

export default async function CursorMcpPage() {
  const topServers = await getCuratedStarterServers(12);
  const client = mcpClientBySlug('cursor');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        name: 'Best MCP Servers for Cursor IDE',
        description: 'Guide to configuring Model Context Protocol (MCP) servers in Cursor AI editor.',
        url: 'https://allmcps.com/mcp-for-cursor',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where is the Cursor MCP config file located?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Cursor MCP config can be placed in .cursor/mcp.json at your project root, or added under Cursor Settings -> Features -> MCP Server.',
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Clients', item: 'https://allmcps.com/clients' },
          { '@type': 'ListItem', position: 3, name: 'Cursor IDE', item: 'https://allmcps.com/mcp-for-cursor' },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container page-shell" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
          <ol className="breadcrumb">
            <li><Link href="/">Home</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href="/clients">Clients</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">Cursor IDE</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', marginBottom: '3rem' }}>
          <Badge variant="verified" style={{ marginBottom: '1rem' }}>Cursor IDE Directory & Generator</Badge>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Best MCP Servers for <span className="text-brand-gradient">Cursor IDE</span>
          </h1>
          <p className="text-lead" style={{ marginBottom: '1.5rem' }}>
            Connect Cursor Composer and AI agents directly to local databases, file systems, GitHub repositories, and external APIs using Model Context Protocol (MCP).
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="#top-servers" className="btn btn-primary">Top Cursor MCP Servers</Link>
            <Link href="/clients/cursor" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen size={16} /> Full Cursor Setup Guide
            </Link>
          </div>
        </section>

        {/* Interactive Config Generator */}
        {client && <ClientConfigSection client={client} featuredServers={topServers} />}

        {/* Top Servers List */}
        <section id="top-servers" style={{ marginBottom: '4rem' }}>
          <h2 className="text-section" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Top Compatible MCP Servers for Cursor
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {topServers.map((server) => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <li key={server.id}>
                  <Card href={`/mcp/${server.id}`} hoverable className="directory-card-uniform">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <ServerAvatar name={server.name} logoUrl={server.logoUrl} category={server.category} size={40} />
                      <div className="directory-card-title-block" style={{ marginBottom: 0 }}>
                        <h3 className="directory-card-title-text" style={{ fontSize: '1.05rem' }}>
                          {displayName}
                        </h3>
                        {org && <div className="directory-card-org-text">{org}</div>}
                      </div>
                    </div>
                    <div className="directory-card-desc-block">
                      <SafeMarkdown content={server.description || ''} isInline />
                    </div>
                    <div className="directory-card-footer" style={{ justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.75rem' }}>
                      <Badge variant="category">{server.category}</Badge>
                      <ServerConfigCopyButton clientSlug="cursor" serverName={server.name} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </>
  );
}
