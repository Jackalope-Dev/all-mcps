import { Metadata } from 'next';
import { Button } from '../../components/ui/Button';
import { PageShell, PageHeader } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'About AllMCPs & Jackalope Digital',
  description:
    'Learn about AllMCPs — the definitive directory for discovering, sharing, and installing Model Context Protocol (MCP) servers.',
  alternates: {
    canonical: 'https://allmcps.com/about',
  },
};

export default function AboutPage() {
  return (
    <PageShell variant="content" panel className="animate-fade-in">
      <PageHeader
        title={
          <>
            About{' '}
            <span className="wordmark-text">
              <span className="wordmark-all">All</span>
              <span className="wordmark-mcps">MCPs</span>
            </span>
          </>
        }
        description={
          <>
            <strong>AllMCPs</strong> is the premier, open directory for discovering, evaluating, and
            installing Model Context Protocol (MCP) servers to equip AI agents and LLMs with
            real-world superpowers.
          </>
        }
      />

      <div className="feature-grid">
        <div className="surface-muted feature-card">
          <h3>🔍 Discover Tools</h3>
          <p>
            Search hundreds of curated MCP servers spanning databases, APIs, dev tools, and desktop
            applications.
          </p>
        </div>
        <div className="surface-muted feature-card">
          <h3>⚡ 1-Click Install</h3>
          <p>
            Copy pre-formatted Claude Desktop and Cursor JSON configs directly into your local setup.
          </p>
        </div>
        <div className="surface-muted feature-card">
          <h3>🚀 Community Driven</h3>
          <p>
            Submit your own open-source MCP servers to reach thousands of AI developers and users.
          </p>
        </div>
      </div>

      <h2 className="text-section">Built by Jackalope Digital</h2>
      <p style={{ lineHeight: 1.8, marginBottom: '2rem' }}>
        AllMCPs is designed and maintained by <strong>Jackalope Digital</strong>. Our team builds
        high-performance tools, applications, and infrastructure for the modern AI ecosystem.
      </p>

      <div className="form-actions" style={{ borderTop: '1px solid var(--border-color)' }}>
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
          className="btn btn-secondary btn-md"
        >
          Visit Jackalope Digital →
        </a>
      </div>
    </PageShell>
  );
}
