import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Eye, Heart, Download } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { getActiveServers, relatedRankingScore, type Server } from '../../../lib/servers';
import {
  DIRECTORY_CATEGORIES,
  categoryFromSlug,
  categorySlug,
  parseCategoryLabel,
} from '../../../lib/categories';
import { isFeaturedListing, isVerifiedListing } from '../../../lib/featuredStatus';
import { parseServerName } from '../../../lib/displayName';
import { BEST_TOPICS } from '../../../lib/bestTopics';

const SITE = 'https://allmcps.com';

/** Cap the server-rendered card list; larger categories link out to the full filter view. */
const MAX_CARDS = 60;

/** Ranking mirrors lib/servers.relatedRankingScore so ordering is consistent site-wide. */
function score(s: Server): number {
  return relatedRankingScore(s);
}

/**
 * Hand-written intros for the highest-traffic categories; every other category gets a
 * templated-but-unique paragraph (label + count + named examples) so no page is thin
 * or duplicated.
 */
const CURATED_INTRO: Record<string, string> = {
  'developer-tools':
    'MCP servers that plug AI agents straight into the developer workflow — running code, managing repositories, querying build systems, and automating the everyday tasks engineers repeat all day.',
  'databases':
    'Connect Claude, Cursor, and other AI agents to your data. These MCP servers expose SQL and NoSQL databases, warehouses, and query engines so an agent can read, analyze, and (carefully) write real records.',
  'security':
    'Security-focused MCP servers for scanning, auditing, secrets management, and threat analysis — giving AI agents safe, scoped access to the tools security teams already rely on.',
  'search-and-data-extraction':
    'MCP servers that let agents search the web, scrape pages, and pull structured data out of unstructured sources — turning the open internet into a queryable tool.',
  'finance-and-fintech':
    'From market data to payments and on-chain activity, these MCP servers give AI agents access to financial APIs and fintech infrastructure with the guardrails that domain demands.',
  'knowledge-and-memory':
    'Persistent memory, note stores, and knowledge bases exposed over MCP, so agents can remember context across sessions and reason over your accumulated knowledge.',
  'browser-automation':
    'Drive a real browser from an AI agent: navigate, click, fill forms, and extract content. These MCP servers wrap headless browsers and automation frameworks behind the protocol.',
  'social-media':
    'MCP servers for posting, reading, and analyzing across social platforms — letting agents draft, schedule, and monitor content programmatically.',
  'data-platforms':
    'Analytics warehouses, data pipelines, and BI platforms exposed over MCP, so agents can pull metrics and run analysis against your production data stack.',
  'cloud-platforms':
    'Provision, inspect, and manage cloud infrastructure through MCP — giving agents scoped access to the APIs behind your deployments.',
};

function introCopy(category: string, count: number, topNames: string[]): string {
  const slug = categorySlug(category);
  if (CURATED_INTRO[slug]) return CURATED_INTRO[slug];
  const { label } = parseCategoryLabel(category);
  const examples =
    topNames.length >= 2
      ? ` Popular picks include ${topNames.slice(0, 3).join(', ')}.`
      : '';
  return `Discover ${count.toLocaleString()} ${label} MCP server${count === 1 ? '' : 's'} for AI agents. Browse, compare, and install Model Context Protocol tools that connect Claude, Cursor, and other clients to ${label.toLowerCase()} capabilities.${examples}`;
}

export function generateStaticParams() {
  return DIRECTORY_CATEGORIES.map((c) => ({ slug: categorySlug(c) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) return { title: 'Category Not Found' };
  const { label } = parseCategoryLabel(category);
  const title = `${label} MCP Servers`;
  const description = `Browse and install the best ${label} Model Context Protocol (MCP) servers for AI agents. Compare tools, view install commands, and connect Claude, Cursor, and more.`;
  const url = `${SITE}/categories/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | AllMCPs`, description, url },
    twitter: { card: 'summary_large_image', title: `${title} | AllMCPs`, description },
  };
}

export default async function CategoryLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const { emoji, label } = parseCategoryLabel(category);
  const all = await getActiveServers();
  const inCategory = all.filter((s) => s.category === category).sort((a, b) => score(b) - score(a));
  const total = inCategory.length;
  const cards = inCategory.slice(0, MAX_CARDS);
  const topNames = inCategory.slice(0, 3).map((s) => parseServerName(s.name).displayName);

  const intro = introCopy(category, total, topNames);
  const url = `${SITE}/categories/${slug}`;

  // Sibling categories for cross-linking, most-populated first.
  const counts = new Map<string, number>();
  for (const s of all) counts.set(s.category, (counts.get(s.category) || 0) + 1);
  const related = Array.from(counts.entries())
    .filter(([name]) => name !== category)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, ...parseCategoryLabel(name), slug: categorySlug(name) }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${label} MCP Servers`,
        description: intro,
        url,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: total,
          itemListElement: cards.map((s, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE}/mcp/${s.id}`,
            name: s.name,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Categories', item: `${SITE}/categories` },
          { '@type': 'ListItem', position: 3, name: label, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="container page-shell" style={{ paddingBottom: '4rem' }}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '2rem' }}>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li>
              <Link href="/categories">Categories</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">{label}</li>
          </ol>
        </nav>

        {/* Hero */}
        <section style={{ marginBottom: '2.5rem', maxWidth: '760px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            {emoji && (
              <span style={{ fontSize: '2.25rem', lineHeight: 1 }} aria-hidden="true">
                {emoji}
              </span>
            )}
            <h1 className="text-display" style={{ margin: 0 }}>
              {label} MCP Servers
            </h1>
          </div>
          <p className="text-lead" style={{ margin: '0 0 1rem' }}>
            {intro}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge variant="category">
              {total.toLocaleString()} {total === 1 ? 'server' : 'servers'}
            </Badge>
            <Link href={`/browse?category=${encodeURIComponent(category)}`} className="btn btn-secondary">
              Open in interactive directory
            </Link>
            {(() => {
              const best = BEST_TOPICS.find((t) => t.categorySlug === slug);
              return best ? (
                <Link href={`/best/${best.slug}`} className="btn btn-secondary">
                  Best {best.title} servers →
                </Link>
              ) : null;
            })()}
          </div>
        </section>

        {/* Server grid */}
        {cards.length > 0 ? (
          <div className="directory-grid">
            {cards.map((server) => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <Card key={server.id} href={`/mcp/${server.id}`} className="directory-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={44} />
                    <div style={{ minWidth: 0 }}>
                      <h2
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayName}
                      </h2>
                      {org && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {org}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      marginBottom: '1.25rem',
                      flexGrow: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <SafeMarkdown content={server.description || 'No description provided.'} isInline />
                  </div>
                  <div className="directory-card-footer">
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
                      {isFeaturedListing(server) && (
                        <Badge
                          variant="success"
                          style={{
                            background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,123,255,0.12))',
                            color: '#00E5FF',
                            borderColor: 'rgba(0,229,255,0.35)',
                          }}
                        >
                          ★ Featured
                        </Badge>
                      )}
                      {isVerifiedListing(server) && <Badge variant="official">Verified</Badge>}
                    </div>
                    <div className="directory-card-stats" style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Eye size={13} /> {(server.views || 0).toLocaleString()}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Download size={13} /> {(server.copies || 0).toLocaleString()}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Heart size={13} /> {(server.upvotes || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="surface empty-state" style={{ borderStyle: 'dashed' }}>
            <p className="empty-state-body" style={{ margin: 0 }}>
              No servers are listed in this category yet.{' '}
              <Link href="/submit">Submit one →</Link>
            </p>
          </div>
        )}

        {total > cards.length && (
          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <Link href={`/browse?category=${encodeURIComponent(category)}`} className="btn btn-primary">
              Browse all {total.toLocaleString()} {label} servers →
            </Link>
          </div>
        )}

        {/* Related categories */}
        {related.length > 0 && (
          <section style={{ marginTop: '4rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Explore related categories
            </h2>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/categories/${r.slug}`}
                  className="badge badge-link badge-category"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {r.emoji && <span aria-hidden="true">{r.emoji}</span>}
                  <span>{r.label}</span>
                  <span style={{ opacity: 0.6 }}>({r.count.toLocaleString()})</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
