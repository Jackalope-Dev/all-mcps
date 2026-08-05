import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Sparkles, ArrowRight, Layers, Bot, Cpu } from 'lucide-react';
import { WORKFLOW_PROMPTS } from '@/lib/prompts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const metadata: Metadata = {
  title: 'Agent Multi-MCP Workflow & System Prompt Library',
  description:
    'Curated multi-MCP agent system prompts and workflow configurations. One-click system prompts and combined claude_desktop_config.json for Full-Stack, Research, DevOps, and Data Science agents.',
  alternates: { canonical: 'https://allmcps.com/prompts' },
  openGraph: {
    title: 'Agent Multi-MCP Workflow & System Prompt Library | AllMCPs',
    description:
      'Curated multi-MCP system prompts and combined installer configs for Cursor, Claude Desktop, Windsurf, and VS Code.',
    url: 'https://allmcps.com/prompts',
  },
};

export default function PromptsHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Agent Multi-MCP Workflow & System Prompt Library',
        description: 'Curated multi-MCP agent system prompts and combined configuration suites.',
        url: 'https://allmcps.com/prompts',
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: 'https://allmcps.com' },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: WORKFLOW_PROMPTS.length,
          itemListElement: WORKFLOW_PROMPTS.map((w, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: w.title,
            url: `https://allmcps.com/prompts/${w.slug}`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Prompt Library', item: 'https://allmcps.com/prompts' },
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
            <li className="breadcrumb-current">Prompt Library</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', marginBottom: '3rem' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Agent Multi-MCP <span className="text-brand-gradient">Workflow &amp; Prompt Library</span>
          </h1>
          <p className="text-lead" style={{ margin: 0 }}>
            Combine multiple Model Context Protocol (MCP) servers into powerful multi-tool agent workflows. Get copyable system prompts and combined configuration JSONs for your favorite AI client.
          </p>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {WORKFLOW_PROMPTS.map((w) => (
            <Card key={w.slug} href={`/prompts/${w.slug}`} hoverable style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <Badge variant="category">{w.category}</Badge>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#00E5FF', fontWeight: 600 }}>
                  <Layers size={14} /> {w.requiredMcps.length} MCPs Combined
                </div>
              </div>

              <div style={{ minHeight: '3.5rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {w.title}
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#00E5FF', fontWeight: 600, margin: '0.2rem 0 0' }}>
                  {w.subtitle}
                </p>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', height: '3.9rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
                {w.description}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  View Workflow &amp; Prompts <ArrowRight size={14} />
                </span>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
