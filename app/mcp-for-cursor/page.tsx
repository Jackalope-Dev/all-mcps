import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Sparkles, Terminal, Eye, Heart, Download } from 'lucide-react';
import { getActiveServers } from '@/lib/servers';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ServerAvatar } from '@/components/ui/ServerAvatar';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { parseServerName } from '@/lib/displayName';
import { isVerifiedListing } from '@/lib/featuredStatus';

export const metadata: Metadata = {
  title: 'Best MCP Servers for Cursor IDE — Discovery & Setup Guide',
  description:
    'Find and install the best Model Context Protocol (MCP) servers for Cursor AI editor. Step-by-step setup for database, search, and developer tools in .cursor/mcp.json.',
  alternates: { canonical: 'https://allmcps.com/mcp-for-cursor' },
  openGraph: {
    title: 'Best MCP Servers for Cursor IDE | AllMCPs',
    description:
      'Connect Cursor AI agent to local databases, GitHub, web search, and dev tools using Model Context Protocol.',
    url: 'https://allmcps.com/mcp-for-cursor',
  },
};

export default async function CursorMcpPage() {
  const allServers = await getActiveServers();
  const topServers = allServers.slice(0, 12);

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
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Best MCP Servers for <span className="text-brand-gradient">Cursor IDE</span>
          </h1>
          <p className="text-lead" style={{ marginBottom: '1.5rem' }}>
            Connect Cursor Composer and AI agents directly to local databases, file systems, GitHub repositories, and external APIs using Model Context Protocol (MCP).
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="#top-servers" className="btn btn-primary">Top Cursor MCP Servers</Link>
            <Link href="/clients/cursor" className="btn btn-secondary">Full Cursor Setup Guide</Link>
          </div>
        </section>

        <section className="surface" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '3rem', border: '1px solid rgba(0,229,255,0.3)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={20} style={{ color: 'var(--accent-color)' }} />
            Quick Setup in `.cursor/mcp.json`
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Create or edit <code>.cursor/mcp.json</code> in your project repository:
          </p>
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
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}`}</code>
          </pre>
        </section>

        <section id="top-servers" style={{ marginBottom: '4rem' }}>
          <h2 className="text-section" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Top Compatible MCP Servers for Cursor
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
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
