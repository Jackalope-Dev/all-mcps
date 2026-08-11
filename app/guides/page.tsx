import { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  Terminal,
  Cpu,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Layers,
  Key,
  Server,
  Wrench,
  Bug,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export const metadata: Metadata = {
  title: 'Model Context Protocol Guides & Tutorials',
  description:
    'MCP guides: what MCP is, install and setup, build and deploy servers, security, and troubleshooting connection failures, zero tools, and timeouts.',
  alternates: {
    canonical: 'https://allmcps.com/guides',
  },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
    title: 'Model Context Protocol Guides & Tutorials | AllMCPs',
    description:
      'MCP guides: what MCP is, install and setup, build and deploy servers, security, and troubleshooting connection failures, zero tools, and timeouts.',
    url: 'https://allmcps.com/guides',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Model Context Protocol Guides & Tutorials | AllMCPs',
    description:
      'MCP guides: what MCP is, install and setup, build and deploy servers, security, and troubleshooting connection failures, zero tools, and timeouts.',
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
  {
    slug: 'deploy-mcp-server',
    href: '/deploy-mcp-server',
    title: 'Deploying & Hosting Remote MCP Servers',
    subtitle: 'Production & Cloud Hosting Guide',
    description:
      'Deploy remote MCP servers to production: step-by-step blueprints for Cloudflare Workers, Docker, Fly.io, AWS, SSE transport setup, CORS, SSL, and monitoring.',
    level: 'DevOps',
    readTime: '14 min read',
    icon: Server,
    badgeVariant: 'premium' as const,
    highlights: [
      'Cloudflare Workers, Docker & Fly.io blueprints',
      'Express & FastMCP SSE transport implementation',
      'CORS, SSL, & environment secrets management',
      'Health checks & production logging hygiene',
    ],
  },
  {
    slug: 'securing-remote-mcp-servers-authentication-guide',
    href: '/blog/securing-remote-mcp-servers-authentication-guide',
    title: 'Securing & Authenticating Remote MCP Servers',
    subtitle: 'Enterprise Authentication & Security',
    description:
      'Master remote MCP server security over HTTP/SSE: OAuth 2.0 PKCE auth flow, JWT validation, multi-tenant token propagation, and prompt injection defense.',
    level: 'Enterprise',
    readTime: '12 min read',
    icon: Key,
    badgeVariant: 'official' as const,
    highlights: [
      'stdio vs Remote HTTP/SSE security boundary',
      'OAuth 2.0 PKCE & JWT Bearer authentication',
      'TypeScript Express multi-tenant server code',
      'Prompt injection & tool poisoning defenses',
    ],
  },
  {
    slug: 'mcp-security',
    href: '/mcp-security',
    title: 'MCP Security Best Practices',
    subtitle: 'Security & Hardening',
    description:
      'Use MCP servers safely: the threat model, prompt injection & tool poisoning, vetting servers, least-privilege credentials, sandboxing, and a pre-install checklist.',
    level: 'Security',
    readTime: '10 min read',
    icon: ShieldCheck,
    badgeVariant: 'verified' as const,
    highlights: [
      'The MCP threat model, plainly explained',
      'Prompt injection & tool poisoning defenses',
      'Least-privilege credentials & sandboxing',
      'A pre-install security checklist',
    ],
  },
  {
    slug: 'mcp-troubleshooting',
    href: '/mcp-troubleshooting',
    title: 'MCP Troubleshooting',
    subtitle: 'Fix Connection Failures',
    description:
      'Server not connecting, zero tools, PATH errors, stdout corruption, missing env vars, and timeouts — map the symptom to the fix across every major client.',
    level: 'Troubleshooting',
    readTime: '12 min read',
    icon: Wrench,
    badgeVariant: 'verified' as const,
    highlights: [
      'Symptom → cause map for common failures',
      'Where to find Claude / Cursor / Claude Code logs',
      'PATH, config JSON, env vars, and stdio hygiene',
      'Checklist + links to validator & deep-dive posts',
    ],
  },
];

/** Long-tail posts that rank for support queries — linked under the pillar grid. */
const troubleshootingDeepDives = [
  {
    href: '/blog/mcp-server-not-connecting-troubleshooting-guide',
    title: 'MCP Server Not Connecting?',
    description: 'Five failure buckets with exact error text and fixes for Claude Desktop, Claude Code, Cursor, and more.',
  },
  {
    href: '/blog/testing-and-debugging-mcp-servers',
    title: 'Testing & Debugging MCP Servers',
    description: 'Inspector, unit tests, integration harnesses, structured logging, and a pre-publish checklist for authors.',
  },
  {
    href: '/blog/how-to-install-mcp-servers-in-claude-cursor-windsurf-and-vs-code',
    title: 'Install MCP Across Clients',
    description: 'Clean install paths for Claude, Cursor, Windsurf, and VS Code before you debug a bad config.',
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
              Master MCP from the ground up: understand the protocol, connect your favorite AI client, build production-ready servers, or fix connection failures when something breaks.
            </p>
          </div>

          {/* Featured Pillar Guides Grid */}
          <div className="guides-grid">
            {guidesList.map((guide) => {
              const Icon = guide.icon;
              return (
                <article key={guide.slug} className="guide-card group">
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
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {guide.highlights.map((highlight) => (
                          <li key={highlight} className="guide-card-highlight-item">
                            <CheckCircle2 size={15} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '2px' }} />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
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
                </article>
              );
            })}
          </div>

          {/* Troubleshooting deep dives — long-tail SEO posts linked from the hub */}
          <section style={{ marginTop: '3.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Bug size={18} style={{ color: 'var(--accent-color)' }} />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
                Troubleshooting deep dives
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', maxWidth: '640px', lineHeight: 1.6 }}>
              Start with the{' '}
              <Link href="/mcp-troubleshooting">MCP troubleshooting hub</Link>
              {' '}for a symptom map, then dig into these focused write-ups when you need more detail.
            </p>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gap: '0.75rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              }}
            >
              {troubleshootingDeepDives.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="surface"
                    style={{
                      display: 'block',
                      padding: '1.1rem 1.25rem',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      height: '100%',
                    }}
                  >
                    <div style={{ fontWeight: 650, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      {item.description}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Directory Callout Banner */}
          <div className="guide-card-banner">
            <div style={{ maxWidth: '600px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
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
