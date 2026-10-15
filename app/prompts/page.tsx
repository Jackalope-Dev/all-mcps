import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type React from 'react';
import { TopicFilter } from '@/components/content/TopicFilter';
import { workflowIdentity } from '@/components/content/workflowIdentity';
import { serializeJsonLd } from '@/lib/jsonLd';
import { WORKFLOW_PROMPTS, workflowCategoryId } from '@/lib/prompts';

export const metadata: Metadata = {
  title: 'Agent Multi-MCP Workflow & System Prompt Library',
  description:
    'Copy-ready multi-MCP agent workflows: PR review, Sentry triage, Playwright tests, Figma to code, Supabase migrations, incident response, SEO audits and more.',
  alternates: { canonical: 'https://allmcps.com/prompts' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
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
        description:
          'Curated multi-MCP agent system prompts and combined configuration suites.',
        url: 'https://allmcps.com/prompts',
        isPartOf: {
          '@type': 'WebSite',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
        },
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
        ],
      },
    ],
  };

  const [featured, ...rest] = WORKFLOW_PROMPTS;
  const featuredId = featured ? workflowIdentity(featured.slug) : null;
  // Category chips in first-appearance order, counted over the grid (the
  // featured workflow sits above the filter, like the guides hub).
  const categories = new Map<string, { label: string; count: number }>();
  for (const w of rest) {
    const id = workflowCategoryId(w.category);
    const entry = categories.get(id);
    if (entry) entry.count += 1;
    else categories.set(id, { label: w.category, count: 1 });
  }
  const topics = [...categories].map(([id, c]) => ({ id, ...c }));
  const FeaturedIcon = featuredId?.icon;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="page-shell content-page content-hub">
        <div className="page-shell-inner">
          <header className="content-hub-head animate-in">
            <nav aria-label="Breadcrumb">
              <ol className="crumbs">
                <li>
                  <Link href="/">Home</Link>
                </li>
                <li>
                  <span aria-current="page">Prompt Library</span>
                </li>
              </ol>
            </nav>
            <h1 className="content-hub-title">
              Agent Multi-MCP Workflow &amp; Prompt Library
            </h1>
            <p className="content-hub-lede">
              Combine multiple Model Context Protocol (MCP) servers into
              powerful multi-tool agent workflows. Get copyable system prompts
              and combined configuration JSONs for your favorite AI client.
            </p>
          </header>

          {featured ? (
            <Link
              href={`/prompts/${featured.slug}`}
              className={`blog-featured spotlight pr-featured animate-in hue-${featuredId?.hue}`}
              style={{ '--i': 1 } as React.CSSProperties}
            >
              <span className="pr-featured-top">
                {FeaturedIcon ? (
                  <span
                    className="tint-tile-solid tint-tile-solid--lg"
                    aria-hidden="true"
                  >
                    <FeaturedIcon size={22} />
                  </span>
                ) : null}
                <span className="blog-featured-label">
                  Featured · {featured.category}
                </span>
              </span>
              <h2 className="blog-featured-title">{featured.title}</h2>
              <p className="blog-featured-excerpt">{featured.description}</p>
              <span className="blog-featured-foot">
                <span className="pr-mcps">
                  {featured.requiredMcps.map((m) => (
                    <span key={m.id} className="content-tag">
                      {m.name}
                    </span>
                  ))}
                </span>
                <span className="blog-read">
                  View workflow &amp; prompts{' '}
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
              </span>
            </Link>
          ) : null}

          <section aria-labelledby="all-workflows" className="guides-all">
            <h2 id="all-workflows" className="content-section-title">
              All workflows
            </h2>
            <TopicFilter
              topics={topics}
              total={rest.length}
              label="Filter workflows by category"
            >
              <ul className="guides-grid pr-grid">
                {rest.map((w, i) => {
                  const { icon: Icon, hue } = workflowIdentity(w.slug);
                  return (
                    <li
                      key={w.slug}
                      data-topic={workflowCategoryId(w.category)}
                      className="animate-in"
                      style={
                        { '--i': Math.min(i + 2, 9) } as React.CSSProperties
                      }
                    >
                      <Link
                        href={`/prompts/${w.slug}`}
                        className={`guides-card spotlight hue-${hue}`}
                      >
                        <span className="guides-card-top">
                          <span className="tint-tile-solid" aria-hidden="true">
                            <Icon size={18} />
                          </span>
                          <span className="guides-card-topic">
                            {w.category}
                          </span>
                          <span className="guides-card-time tabular">
                            {w.requiredMcps.length} MCPs
                          </span>
                        </span>
                        <h3 className="guides-card-title">{w.title}</h3>
                        <p className="pr-card-subtitle">{w.subtitle}</p>
                        <p className="guides-card-desc">{w.description}</p>
                        <span className="guides-card-cta">
                          View workflow{' '}
                          <ArrowRight size={14} aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </TopicFilter>
          </section>
        </div>
      </main>
    </>
  );
}
