import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleLayout } from '@/components/content/ArticleLayout';
import { workflowIdentity } from '@/components/content/workflowIdentity';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { FaqSection } from '@/components/ui/FaqSection';
import { serializeJsonLd } from '@/lib/jsonLd';
import { getWorkflowBySlug, WORKFLOW_PROMPTS } from '@/lib/prompts';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const workflow = getWorkflowBySlug(slug);
  if (!workflow)
    return {
      title: 'Workflow Not Found',
      robots: { index: false, follow: false },
    };

  const title = `${workflow.title} MCP Setup`;
  const description = truncate(workflow.description, 157);

  return {
    title,
    description,
    alternates: { canonical: `https://allmcps.com/prompts/${workflow.slug}` },
    openGraph: {
      images: [
        {
          url: 'https://allmcps.com/opengraph-image',
          width: 1200,
          height: 630,
          alt: 'AllMCPs',
        },
      ],
      title: `${title} | AllMCPs`,
      description,
      url: `https://allmcps.com/prompts/${workflow.slug}`,
    },
  };
}

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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

  const combinedConfigJson = JSON.stringify(
    { mcpServers: combinedMcpServers },
    null,
    2,
  );

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
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://allmcps.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Prompt Library',
            item: 'https://allmcps.com/prompts',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: workflow.title,
            item: `https://allmcps.com/prompts/${workflow.slug}`,
          },
        ],
      },
    ],
  };

  const { icon: WorkflowIcon, hue } = workflowIdentity(workflow.slug);

  // Same-category workflows first, then the rest of the library, capped so
  // the footer stays a short list as the library grows.
  const others = WORKFLOW_PROMPTS.filter((w) => w.slug !== workflow.slug);
  const related = [
    ...others.filter((w) => w.category === workflow.category),
    ...others.filter((w) => w.category !== workflow.category),
  ].slice(0, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ArticleLayout
        icon={
          <span
            className={`tint-tile-solid tint-tile-solid--lg hue-${hue}`}
            aria-hidden="true"
          >
            <WorkflowIcon size={22} />
          </span>
        }
        crumbs={[
          { label: 'Prompt Library', href: '/prompts' },
          { label: workflow.title },
        ]}
        title={workflow.title}
        lede={
          <>
            <p className="pr-subtitle">{workflow.subtitle}</p>
            <p>{workflow.description}</p>
          </>
        }
        meta={<span>{workflow.requiredMcps.length} MCP servers combined</span>}
        toc={[
          { id: 'included-servers', text: 'Included MCP servers' },
          { id: 'system-prompt', text: 'System prompt' },
          { id: 'combined-config', text: 'Combined config' },
          ...(workflow.faq.length > 0 ? [{ id: 'faq', text: 'FAQ' }] : []),
        ]}
        prose={false}
        progress={false}
      >
        <section className="pr-section" aria-labelledby="included-servers">
          <h2 id="included-servers" className="content-section-title">
            Included MCP Servers ({workflow.requiredMcps.length})
          </h2>
          <ul className="pr-servers">
            {workflow.requiredMcps.map((mcp) => (
              <li key={mcp.id} className="pr-server">
                <Link href={`/mcp/${mcp.id}`} className="pr-server-name">
                  {mcp.name} <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <p>{mcp.description}</p>
                <code>
                  {mcp.command} {mcp.args.join(' ')}
                </code>
              </li>
            ))}
          </ul>
        </section>

        <section className="pr-section" aria-labelledby="system-prompt">
          <h2 id="system-prompt" className="content-section-title">
            Optimized Agent System Prompt
          </h2>
          <p className="pr-section-lede">
            Paste this system prompt into Cursor (.cursorrules), Claude Desktop,
            Windsurf, or Antigravity:
          </p>
          <CopyBlock code={workflow.systemPrompt} />
        </section>

        <section className="pr-section" aria-labelledby="combined-config">
          <h2 id="combined-config" className="content-section-title">
            Combined Suite <code>claude_desktop_config.json</code>
          </h2>
          <p className="pr-section-lede">
            One single JSON configuration containing all required MCP servers
            for this workflow:
          </p>
          <CopyBlock code={combinedConfigJson} />
        </section>

        {workflow.faq.length > 0 && (
          <section className="pr-section">
            <FaqSection
              title="Frequently Asked Questions"
              headingId="faq"
              renderJsonLd={false}
              items={workflow.faq.map((f) => ({ question: f.q, answer: f.a }))}
            />
          </section>
        )}

        <nav className="pr-section" aria-labelledby="more-workflows">
          <h2 id="more-workflows" className="content-section-title">
            More workflows
          </h2>
          <ul className="content-related">
            {related.map((w) => {
              const { icon: Icon, hue: wHue } = workflowIdentity(w.slug);
              return (
                <li key={w.slug}>
                  <Link
                    href={`/prompts/${w.slug}`}
                    className={`content-related-card pr-related hue-${wHue}`}
                  >
                    <span
                      className="tint-tile-solid pr-related-icon"
                      aria-hidden="true"
                    >
                      <Icon size={15} />
                    </span>
                    <strong>{w.title}</strong>
                    <span>{w.subtitle}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="pr-section-lede">
            <Link href="/prompts">
              Browse all {WORKFLOW_PROMPTS.length} workflows{' '}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </p>
        </nav>
      </ArticleLayout>
    </>
  );
}
