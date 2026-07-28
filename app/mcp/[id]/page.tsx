import fs from 'fs';
import path from 'path';
import { ArrowLeft, CheckCircle2, Github, Terminal } from 'lucide-react';
import Link from 'next/link';

// Define the type for our server data
type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
};

async function getServer(id: string): Promise<Server | undefined> {
  const filePath = path.join(process.cwd(), 'data', 'mcp-servers.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const servers: Server[] = JSON.parse(fileContents);
  return servers.find((s) => s.id === id);
}

// Generate static params so Next.js can pre-render these pages at build time
export async function generateStaticParams() {
  const filePath = path.join(process.cwd(), 'data', 'mcp-servers.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const servers: Server[] = JSON.parse(fileContents);
  return servers.slice(0, 50).map((server) => ({
    id: server.id,
  }));
}

export default async function MCPDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    return (
      <div className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}>
        <h1>Server Not Found</h1>
        <Link href="/" style={{ color: 'var(--accent-color)', marginTop: '1rem', display: 'inline-block' }}>← Back to Directory</Link>
      </div>
    );
  }

  // The command name usually strips out 'mcp-' prefixes or uses the raw name for the npm package
  const installName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

  return (
    <main className="container" style={{ paddingBottom: '6rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }} className="nav-link">
          <ArrowLeft size={16} /> Back to Directory
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', alignItems: 'start' }}>
        
        {/* Main Content (Left Column) */}
        <div style={{ gridColumn: '1 / span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>{server.name}</h1>
            {server.isOfficial && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', padding: '0.25rem 0.75rem', borderRadius: '2rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <CheckCircle2 size={14} /> Official
              </span>
            )}
          </div>
          
          <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
            {server.description}
          </p>

          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={20} /> Quick Install (Claude Desktop)
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>Add this directly to your <code>claude_desktop_config.json</code> file:</p>
            <div style={{ position: 'relative' }}>
              <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '8px', overflowX: 'auto', border: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
{`"mcpServers": {
  "${installName}": {
    "command": "npx",
    "args": ["-y", "${installName}"]
  }
}`}
              </pre>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Documentation Overview</h2>
            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <p>This is a placeholder for the dynamically fetched README content. Once we set up the GitHub API integration in the Cloudflare Worker, the full markdown documentation for <strong>{server.name}</strong> will render here automatically!</p>
            </div>
          </div>
        </div>

        {/* Sidebar (Right Column) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
              Verified Active
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Last checked by Cloudflare Cron.</p>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Links</h3>
            <a href={server.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 500, transition: 'background 0.2s', border: '1px solid var(--border-color)' }} className="nav-link">
              <Github size={18} /> View Repository
            </a>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Embed Badge</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Add this badge to your README to get a free Featured boost in the directory.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '2rem', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.03)', fontSize: '0.75rem', color: 'var(--text-secondary)', justifyContent: 'center', marginBottom: '1rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
              Verified on AllMCPs
            </div>
            <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '0.75rem', borderRadius: '8px', overflowX: 'auto', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
{`[![AllMCPs](https://img.shields.io/badge/AllMCPs-Verified-blue)](https://allmcps.com/mcp/${server.id})`}
            </pre>
          </div>
          
        </div>
      </div>
    </main>
  );
}
