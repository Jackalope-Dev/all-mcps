import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import { getActiveServers } from '@/lib/servers';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ServerAvatar } from '@/components/ui/ServerAvatar';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { parseServerName } from '@/lib/displayName';
import { mcpClientBySlug } from '@/lib/clients';
import { ClientConfigSection } from '@/components/clients/ClientConfigSection';
import { ServerConfigCopyButton } from '@/components/clients/ServerConfigCopyButton';

export const metadata: Metadata = {
  title: 'Top MCP Servers for Cline & VS Code — Directory & Setup',
  description:
    'Find Model Context Protocol (MCP) servers for Cline (formerly Claude Dev) in VS Code. Interactive setup guide for cline_mcp_settings.json.',
  alternates: { canonical: 'https://allmcps.com/mcp-for-cline' },
  openGraph: {
    title: 'Top MCP Servers for Cline & VS Code | AllMCPs',
    description: 'Connect Cline autonomous coding agent in VS Code to databases, terminal tools, and APIs over MCP.',
    url: 'https://allmcps.com/mcp-for-cline',
  },
};

export default async function ClineMcpPage() {
  const allServers = await getActiveServers();
  const topServers = allServers.slice(0, 12);
  const client = mcpClientBySlug('cline');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        name: 'Top MCP Servers for Cline & VS Code',
        description: 'Guide to configuring Model Context Protocol (MCP) servers in Cline and VS Code.',
        url: 'https://allmcps.com/mcp-for-cline',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where is the cline_mcp_settings.json file located?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'In VS Code, open the Cline side panel settings tab or edit settings directly in line with your workspace config.',
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Clients', item: 'https://allmcps.com/clients' },
          { '@type': 'ListItem', position: 3, name: 'Cline / VS Code', item: 'https://allmcps.com/mcp-for-cline' },
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
            <li className="breadcrumb-current">Cline / VS Code</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', marginBottom: '3rem' }}>
          <Badge variant="verified" style={{ marginBottom: '1rem' }}>Cline / VS Code Directory & Generator</Badge>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Top MCP Servers for <span className="text-brand-gradient">Cline / VS Code</span>
          </h1>
          <p className="text-lead" style={{ marginBottom: '1.5rem' }}>
            Connect Cline in VS Code directly to databases, web search, GitHub repositories, and system tools using Model Context Protocol.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="#top-servers" className="btn btn-primary">Browse Cline MCP Servers</Link>
            <Link href="/clients/cline" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen size={16} /> Cline Setup Guide
            </Link>
          </div>
        </section>

        {/* Interactive Config Generator */}
        {client && <ClientConfigSection client={client} featuredServers={topServers} />}

        {/* Top Servers List */}
        <section id="top-servers" style={{ marginBottom: '4rem' }}>
          <h2 className="text-section" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Cline Compatible MCP Servers
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {topServers.map((server) => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <Card key={server.id} href={`/mcp/${server.id}`} hoverable className="directory-card-uniform">
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
                    <ServerConfigCopyButton clientSlug="cline" serverName={server.name} />
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
