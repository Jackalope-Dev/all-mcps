import { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Terminal, Cpu, ArrowRight, Sparkles, CheckCircle2, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

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
          {/* Hero Section */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles size={14} /> Documentation &amp; Learning Hub
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
              Model Context Protocol Guides
            </h1>
            <p className="text-slate-400 text-lg md:text-xl leading-relaxed">
              Master MCP from the ground up: understand the protocol, connect your favorite AI client, or build production-ready custom servers.
            </p>
          </div>

          {/* Featured Pillar Guides Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {guidesList.map((guide) => {
              const Icon = guide.icon;
              return (
                <div
                  key={guide.slug}
                  className="surface page-panel flex flex-col justify-between hover:border-cyan-500/40 transition-all duration-200 group"
                  style={{ borderRadius: 'var(--radius-lg)', padding: '1.75rem' }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                        <Icon size={20} />
                      </div>
                      <Badge variant={guide.badgeVariant}>{guide.level}</Badge>
                    </div>

                    <h2 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-300 transition-colors">
                      {guide.title}
                    </h2>
                    <p className="text-xs text-cyan-400/80 font-medium mb-3">{guide.subtitle} · {guide.readTime}</p>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                      {guide.description}
                    </p>

                    <div className="space-y-2 mb-6 pt-4 border-t border-slate-800/80">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                        What you&rsquo;ll learn:
                      </span>
                      {guide.highlights.map((highlight) => (
                        <div key={highlight} className="flex items-start gap-2 text-xs text-slate-300">
                          <CheckCircle2 size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                          <span>{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link
                    href={guide.href}
                    className="btn btn-primary w-full justify-center gap-2 mt-2 group-hover:shadow-glow"
                  >
                    <span>Read Guide</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Quick Hub Navigation & Directory Banner */}
          <div
            className="surface p-8 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm mb-2">
                <Layers size={18} /> Directory &amp; Tools
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Ready to test these guides with real servers?
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Explore thousands of open-source and official MCP servers listed on AllMCPs, or use our free configuration generator tool.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
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
