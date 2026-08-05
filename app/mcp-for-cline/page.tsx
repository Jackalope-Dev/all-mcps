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
  title: 'Top MCP Servers for Cline & VS Code — Directory & Setup',
  description:
    'Find Model Context Protocol (MCP) servers for Cline (formerly Claude Dev) in VS Code. Setup guide for cline_mcp_settings.json.',
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

  return (
    <>
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
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Top MCP Servers for <span className="text-brand-gradient">Cline / VS Code</span>
          </h1>
          <p className="text-lead" style={{ marginBottom: '1.5rem' }}>
            Give Cline autonomous AI agent in VS Code direct access to databases, web browsing, GitHub, and system tools over Model Context Protocol.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="#top-servers" className="btn btn-primary">Browse Cline MCP Servers</Link>
            <Link href="/clients/vs-code" className="btn btn-secondary">VS Code Setup Guide</Link>
          </div>
        </section>

        <section className="surface" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '3rem', border: '1px solid rgba(0,229,255,0.3)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={20} style={{ color: 'var(--accent-color)' }} />
            `cline_mcp_settings.json` Snippet
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
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite"],
      "disabled": false,
      "autoApprove": []
    }
  }
}`}</code>
          </pre>
        </section>

        <section id="top-servers" style={{ marginBottom: '4rem' }}>
          <h2 className="text-section" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Cline Compatible MCP Servers
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
