import { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Terminal, Cpu, ArrowRight, Sparkles, CheckCircle2, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export const metadata: Metadata = {
  title: 'Model Context Protocol Guides & Tutorials | AllMCPs',
  description:
    'Comprehensive guides and step-by-step tutorials for Model Context Protocol (MCP): conceptual overview, LLM agent setup, server creation in TypeScript & Python, and ecosystem best practices.',
  alternates: {
    canonical: 'https://allmcps.com/guides',
  },
  openGraph: {
    title: 'Model Context Protocol Guides & Tutorials | AllMCPs',
    description:
      'Comprehensive guides and step-by-step tutorials for Model Context Protocol (MCP): conceptual overview, LLM agent setup, server creation in TypeScript & Python, and ecosystem best practices.',
    url: 'https://allmcps.com/guides',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Model Context Protocol Guides & Tutorials | AllMCPs',
    description:
      'Comprehensive guides and step-by-step tutorials for Model Context Protocol (MCP): conceptual overview, LLM agent setup, server creation in TypeScript & Python, and ecosystem best practices.',
  },
};

const guidesList = [
  {
    slug: 'what-is-mcp',
    href: '/what-is-mcp',
    title: 'What is Model Context Protocol?',
    subtitle: 'Conceptual Beginner Guide',
    description:
      'Learn what MCP is, why it replaces one-off integrations, how host-client-server roles interact, and how JSON-RPC primitives work.',
    level: 'Beginner',
    readTime: '5 min read',
    icon: BookOpen,
    badgeVariant: 'official' as const,
    highlights: [
      'Core architecture & USB-C analogy',
      'Tools vs Resources vs Prompts',
      'Local (stdio) vs Remote (HTTP)',
      'Security & Prompt Injection safety',
    ],
  },
  {
    slug: 'llm-agents-guide',
    href: '/guide',
    title: 'LLM Agents Setup & Configuration Guide',
    subtitle: 'Practical Setup & Integration',
    description:
      'Step-by-step walkthrough to connect Claude Desktop, Claude Code, Cursor, and Windsurf to MCP servers with real JSON config snippets.',
    level: 'Setup & Config',
    readTime: '8 min read',
    icon: Terminal,
    badgeVariant: 'verified' as const,
    highlights: [
      'Configuring claude_desktop_config.json',
      'Adding local stdio servers (npx/uvx)',
      'Connecting remote HTTP/SSE servers',
      'Combining multiple servers & troubleshooting',
    ],
  },
  {
    slug: 'build-mcp-server',
    href: '/build-mcp-server',
    title: 'How to Build an MCP Server',
    subtitle: 'Complete Developer Guide',
    description:
      'Build a custom MCP server from scratch: full TypeScript and Python code for tools, resources, and prompts, local testing, and deployment.',
    level: 'Developer',
    readTime: '15 min read',
    icon: Cpu,
    badgeVariant: 'premium' as const,
    highlights: [
      'TypeScript SDK & FastMCP for Python',
      'Implementing tools, resources & prompts',
      'Testing with MCP Inspector',
      'Deploying to Cloudflare & publishing',
    ],
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'AllMCPs Guides & Tutorials',
  description: 'Comprehensive guides for Model Context Protocol (MCP)',
  itemListElement: guidesList.map((g, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: g.title,
    url: `https://allmcps.com${g.href}`,
  })),
};

export default function GuidesLandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="page-shell page-shell--default">
        <div className="page-shell-inner">
          {/* Centered Hero Header Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              maxWidth: '768px',
              margin: '0 auto 3.5rem',
              padding: '0 1rem',
            }}
          >
            {/* Top Pill Tag with Proper Padding */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1.15rem',
                borderRadius: '9999px',
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                color: '#00E5FF',
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '1.25rem',
                boxShadow: '0 0 16px rgba(0, 229, 255, 0.15)',
              }}
            >
              <Sparkles size={15} style={{ color: '#00E5FF' }} />
              <span>Documentation &amp; Learning Hub</span>
            </div>

            <h1
              className="text-page-title"
              style={{
                fontSize: 'clamp(2.25rem, 5vw, 3.25rem)',
                marginBottom: '1.25rem',
                fontWeight: 800,
                textAlign: 'center',
                width: '100%',
              }}
            >
              Model Context Protocol Guides
            </h1>

            <p
              className="text-lead"
              style={{
                fontSize: '1.15rem',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                margin: '0 auto',
                maxWidth: '640px',
                lineHeight: 1.65,
              }}
            >
              Master MCP from the ground up: understand the protocol, connect your favorite AI client, or build production-ready custom servers.
            </p>
          </div>

          {/* Featured Pillar Guides Grid */}
          <div className="guides-grid">
            {guidesList.map((guide) => {
              const Icon = guide.icon;
              return (
                <div key={guide.slug} className="guide-card group">
                  <div>
                    <div className="guide-card-header">
                      <div className="guide-card-icon">
                        <Icon size={22} />
                      </div>
                      <Badge variant={guide.badgeVariant}>{guide.level}</Badge>
                    </div>

                    <h2 className="guide-card-title">
                      {guide.title}
                    </h2>
                    <div className="guide-card-meta">
                      {guide.subtitle} &middot; {guide.readTime}
                    </div>
                    <p className="guide-card-description">
                      {guide.description}
                    </p>

                    <div className="guide-card-highlights">
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                        What you&rsquo;ll learn:
                      </span>
                      {guide.highlights.map((highlight) => (
                        <div key={highlight} className="guide-card-highlight-item">
                          <CheckCircle2 size={15} style={{ color: '#00E5FF', flexShrink: 0, marginTop: '2px' }} />
                          <span>{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link
                    href={guide.href}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
                  >
                    <span>Read Guide</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Directory Callout Banner */}
          <div className="guide-card-banner">
            <div style={{ maxWidth: '600px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00E5FF', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                <Layers size={18} /> Directory &amp; Tools
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Ready to test these guides with real servers?
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0, lineHeight: 1.6 }}>
                Explore thousands of open-source and official MCP servers listed on AllMCPs, or use our free configuration generator tool.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              <Link href="/browse" className="btn btn-secondary">
                Browse Servers
              </Link>
              <Link href="/submit" className="btn btn-primary">
                Submit Your MCP
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
