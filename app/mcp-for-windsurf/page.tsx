import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Sparkles, Terminal, Eye, Download } from 'lucide-react';
import { getActiveServers } from '@/lib/servers';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ServerAvatar } from '@/components/ui/ServerAvatar';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { parseServerName } from '@/lib/displayName';

export const metadata: Metadata = {
  title: 'Best MCP Servers for Windsurf Cascade — Setup & Directory',
  description:
    'Find Model Context Protocol (MCP) servers compatible with Codeium Windsurf Cascade editor. Setup instructions for ~/.codeium/windsurf/mcp_config.json.',
  alternates: { canonical: 'https://allmcps.com/mcp-for-windsurf' },
  openGraph: {
    title: 'Best MCP Servers for Windsurf Cascade | AllMCPs',
    description: 'Connect Windsurf AI Cascade agent to databases, repositories, and developer tools over MCP.',
    url: 'https://allmcps.com/mcp-for-windsurf',
  },
};

export default async function WindsurfMcpPage() {
  const allServers = await getActiveServers();
  const topServers = allServers.slice(0, 12);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        name: 'Best MCP Servers for Windsurf Cascade',
        description: 'Guide to configuring Model Context Protocol (MCP) servers in Codeium Windsurf Cascade editor.',
        url: 'https://allmcps.com/mcp-for-windsurf',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where is the Windsurf mcp_config.json file located?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The configuration file is located at ~/.codeium/windsurf/mcp_config.json.',
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Clients', item: 'https://allmcps.com/clients' },
          { '@type': 'ListItem', position: 3, name: 'Windsurf', item: 'https://allmcps.com/mcp-for-windsurf' },
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
            <li className="breadcrumb-current">Windsurf</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', marginBottom: '3rem' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Best MCP Servers for <span className="text-brand-gradient">Windsurf Cascade</span>
          </h1>
          <p className="text-lead" style={{ marginBottom: '1.5rem' }}>
            Extend Codeium Windsurf Cascade with external tools, APIs, and local databases via Model Context Protocol.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="#top-servers" className="btn btn-primary">Top Windsurf MCP Tools</Link>
            <Link href="/clients/windsurf" className="btn btn-secondary">Windsurf Guide</Link>
          </div>
        </section>

        <section className="surface" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '3rem', border: '1px solid rgba(0,229,255,0.3)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={20} style={{ color: 'var(--accent-color)' }} />
            `~/.codeium/windsurf/mcp_config.json` Config
          </h2>
          <pre
            style={{
              background: 'rgba(2, 6, 23, 0.95)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              color: '#38bdf8',
              fontSize: '0.85rem',
              overflowX: 'auto',
              margin: 0,
            }}
          >
            <code>{`{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git"]
    }
  }
}`}</code>
          </pre>
        </section>

        <section id="top-servers" style={{ marginBottom: '4rem' }}>
          <h2 className="text-section" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Windsurf Compatible MCP Servers
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {topServers.map((server) => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <Card key={server.id} href={`/mcp/${server.id}`} hoverable className="directory-card-uniform">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={40} />
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
                  <div className="directory-card-footer">
                    <Badge variant="category">{server.category}</Badge>
                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span><Eye size={12} /> {(server.views || 0).toLocaleString()}</span>
                      <span><Download size={12} /> {(server.copies || 0).toLocaleString()}</span>
                    </div>
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
