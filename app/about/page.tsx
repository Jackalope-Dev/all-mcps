import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '../../components/ui/Button';

export const metadata: Metadata = {
  title: 'About AllMCPs & Jackalope Digital',
  description: 'Learn about AllMCPs — the definitive directory for discovering, sharing, and installing Model Context Protocol (MCP) servers.',
  alternates: {
    canonical: 'https://allmcps.com/about',
  },
};

export default function AboutPage() {
  return (
    <main className="container" style={{ padding: '6rem 0 8rem' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '4rem', maxWidth: '850px', margin: '0 auto', borderRadius: '24px' }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '2.5rem' }}>
          About{' '}
          <span className="wordmark-text">
            <span className="wordmark-all">All</span>
            <span className="wordmark-mcps">MCPs</span>
          </span>
        </h1>
        
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '2.5rem' }}>
          <strong>AllMCPs</strong> is the premier, open directory for discovering, evaluating, and installing Model Context Protocol (MCP) servers to equip AI agents and LLMs with real-world superpowers.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <div className="glass-panel-static" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-color)' }}>🔍 Discover Tools</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: '1.6' }}>
              Search hundreds of curated MCP servers spanning databases, APIs, dev tools, and desktop applications.
            </p>
          </div>
          
          <div className="glass-panel-static" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-color)' }}>⚡ 1-Click Install</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: '1.6' }}>
              Copy pre-formatted Claude Desktop and Cursor JSON configs directly into your local setup.
            </p>
          </div>

          <div className="glass-panel-static" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-color)' }}>🚀 Community Driven</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: '1.6' }}>
              Submit your own open-source MCP servers to reach thousands of AI developers and users.
            </p>
          </div>
        </div>

        <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Built by Jackalope Digital</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '2rem' }}>
          AllMCPs is designed and maintained by <strong>Jackalope Digital</strong>. Our team builds high-performance tools, applications, and infrastructure for the modern AI ecosystem.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <Button href="/submit" variant="primary">
            Submit an MCP Server
          </Button>
          <Button href="/what-is-mcp" variant="secondary">
            Learn What is an MCP
          </Button>
          <a 
            href="https://jackalope.digital" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn" 
            style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', textDecoration: 'none', border: '1px solid var(--border-color)' }}
          >
            Visit Jackalope Digital &rarr;
          </a>
        </div>
      </div>
    </main>
  );
}
