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
  title: 'Top MCP Servers for Claude Desktop — Install & Config Guide',
  description:
    'Discover top Model Context Protocol (MCP) tools for Anthropic Claude Desktop. Setup guide for claude_desktop_config.json on macOS and Windows.',
  alternates: { canonical: 'https://allmcps.com/mcp-for-claude-desktop' },
  openGraph: {
    title: 'Top MCP Servers for Claude Desktop | AllMCPs',
    description:
      'Give Claude Desktop superpowers with local files, SQLite, GitHub, and API integrations over MCP.',
    url: 'https://allmcps.com/mcp-for-claude-desktop',
  },
};

export default async function ClaudeDesktopMcpPage() {
  const allServers = await getActiveServers();
  const topServers = allServers.slice(0, 12);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        name: 'Top MCP Servers for Claude Desktop',
        description: 'Guide to configuring Model Context Protocol (MCP) servers in Anthropic Claude Desktop.',
        url: 'https://allmcps.com/mcp-for-claude-desktop',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where is claude_desktop_config.json located?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'On macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. On Windows: %APPDATA%\\Claude\\claude_desktop_config.json.',
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
            <li className="breadcrumb-current">Claude Desktop</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', marginBottom: '3rem' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Top MCP Servers for <span className="text-brand-gradient">Claude Desktop</span>
          </h1>
          <p className="text-lead" style={{ marginBottom: '1.5rem' }}>
            Connect Claude Desktop directly to your desktop files, databases, and favorite tools. Install verified MCP servers with one click.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="#top-servers" className="btn btn-primary">Browse Claude MCP Servers</Link>
            <Link href="/clients/claude-desktop" className="btn btn-secondary">Claude Desktop Guide</Link>
          </div>
        </section>

        <section className="surface" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '3rem', border: '1px solid rgba(0,229,255,0.3)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={20} style={{ color: 'var(--accent-color)' }} />
            `claude_desktop_config.json` Snippet
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
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/yourname/Desktop"]
    }
  }
}`}</code>
          </pre>
        </section>

        <section id="top-servers" style={{ marginBottom: '4rem' }}>
          <h2 className="text-section" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Featured Claude Desktop Servers
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {topServers.map((server) => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <Card key={server.id} href={`/mcp/${server.id}`} hoverable style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={40} />
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                      </h3>
                      {org && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{org}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', flexGrow: 1 }}>
                    <SafeMarkdown content={server.description || ''} isInline />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
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
