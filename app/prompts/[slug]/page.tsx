import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Sparkles, Terminal, Layers, Check, Copy } from 'lucide-react';
import { WORKFLOW_PROMPTS, getWorkflowBySlug } from '@/lib/prompts';
import { Badge } from '@/components/ui/Badge';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { FaqSection } from '@/components/ui/FaqSection';

export function generateStaticParams() {
  return WORKFLOW_PROMPTS.map((w) => ({ slug: w.slug }));
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const workflow = getWorkflowBySlug(slug);
  if (!workflow) return { title: 'Workflow Not Found', robots: { index: false, follow: false } };

  const title = `${workflow.title} MCP Setup`;
  const description = truncate(workflow.description, 157);

  return {
    title,
    description,
    alternates: { canonical: `https://allmcps.com/prompts/${workflow.slug}` },
    openGraph: {
      title: `${title} | AllMCPs`,
      description,
      url: `https://allmcps.com/prompts/${workflow.slug}`,
    },
  };
}

export default async function WorkflowDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workflow = getWorkflowBySlug(slug);
  if (!workflow) notFound();

  // Combine mcpServers into one single JSON
  const combinedMcpServers: Record<string, any> = {};
  workflow.requiredMcps.forEach((mcp) => {
    const key = mcp.id.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    combinedMcpServers[key] = {
      command: mcp.command,
      args: mcp.args,
    };
  });

  const combinedConfigJson = JSON.stringify({ mcpServers: combinedMcpServers }, null, 2);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        name: workflow.title,
        description: workflow.description,
        url: `https://allmcps.com/prompts/${workflow.slug}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: workflow.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Prompt Library', item: 'https://allmcps.com/prompts' },
          { '@type': 'ListItem', position: 3, name: workflow.title, item: `https://allmcps.com/prompts/${workflow.slug}` },
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
            <li><Link href="/prompts">Prompt Library</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">{workflow.title}</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', margin: '0 auto 2.5rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', justifyContent: 'center' }}>
            <Badge variant="category">{workflow.category}</Badge>
          </div>
          <h1 className="text-display" style={{ marginBottom: '0.75rem' }}>
            {workflow.title}
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--accent-color)', fontWeight: 600, marginBottom: '1rem' }}>
            {workflow.subtitle}
          </p>
          <p className="text-lead" style={{ margin: '0 auto' }}>
            {workflow.description}
          </p>
        </section>

        {/* Required MCP Servers Suite */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} style={{ color: 'var(--accent-color)' }} /> Included MCP Servers ({workflow.requiredMcps.length})
          </h2>
          <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', listStyle: 'none', margin: 0, padding: 0 }}>
            {workflow.requiredMcps.map((mcp) => (
              <li key={mcp.id} className="surface" style={{ listStyle: 'none', padding: '1.25rem', borderRadius: '12px' }}>
                <Link href={`/mcp/${mcp.id}`} style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', textDecoration: 'none' }}>
                  {mcp.name} →
                </Link>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0.75rem', lineHeight: 1.45 }}>
                  {mcp.description}
                </p>
                <code style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(0,0,0,0.4)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  {mcp.command} {mcp.args.join(' ')}
                </code>
              </li>
            ))}
          </ul>
        </section>

        {/* System Prompt Block */}
        <section className="surface" style={{ padding: '1.75rem', borderRadius: '16px', marginBottom: '3rem', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} style={{ color: 'var(--accent-color)' }} /> Optimized Agent System Prompt
            </h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Paste this system prompt into Cursor (.cursorrules), Claude Desktop, Windsurf, or Antigravity:
          </p>
          <CopyBlock code={workflow.systemPrompt} />
        </section>

        {/* Combined Config JSON */}
        <section className="surface" style={{ padding: '1.75rem', borderRadius: '16px', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={18} style={{ color: 'var(--accent-color)' }} /> Combined Suite `claude_desktop_config.json`
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            One single JSON configuration containing all required MCP servers for this workflow:
          </p>
          <CopyBlock code={combinedConfigJson} />
        </section>

        {/* FAQ */}
        {workflow.faq.length > 0 && (
          <section style={{ maxWidth: '760px' }}>
            <FaqSection
              title="Frequently Asked Questions"
              items={workflow.faq.map((f) => ({ question: f.q, answer: f.a }))}
            />
          </section>
        )}
      </main>
    </>
  );
}
