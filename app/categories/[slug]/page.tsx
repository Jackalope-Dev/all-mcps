import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight, Eye, Heart, Download } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { FaqSection } from '../../../components/ui/FaqSection';
import { getActiveServers, relatedRankingScore, type Server } from '../../../lib/servers';
import {
  DIRECTORY_CATEGORIES,
  categoryFromSlug,
  categorySlug,
  parseCategoryLabel,
  getCategoryMeta,
  categoryIntroCopy,
} from '../../../lib/categories';
import { isFeaturedListing, isVerifiedListing } from '../../../lib/featuredStatus';
import { parseServerName } from '../../../lib/displayName';
import { bestTopicForCategory } from '../../../lib/bestTopics';
import { CategorySponsorBanner } from '../../../components/CategorySponsorBanner';
import { ImpressionBeacon } from '../../../components/ImpressionTracker';

const SITE = 'https://allmcps.com';

/** Cap the server-rendered card list; larger categories link out to the full filter view. */
const MAX_CARDS = 60;

/** Ranking mirrors lib/servers.relatedRankingScore so ordering is consistent site-wide. */
function score(s: Server): number {
  return relatedRankingScore(s);
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
  const canonicalSlug = categorySlug(category);
  const { label } = parseCategoryLabel(category);
  const title = `${label} MCP Servers`;
  const rawDescription = `Browse and install the best ${label} Model Context Protocol (MCP) servers for AI agents. Compare tools, view install commands, and connect Claude, Cursor, and more.`;
  const description =
    rawDescription.length > 157 ? `${rawDescription.slice(0, 154)}...` : rawDescription;
  const url = `${SITE}/categories/${canonicalSlug}`;
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

  // Canonical slug redirect (e.g. /categories/end-to-end-rag-platforms -> /categories/search-and-data-extraction)
  const canonicalSlug = categorySlug(category);
  if (slug !== canonicalSlug) {
    redirect(`/categories/${canonicalSlug}`);
  }

  const { emoji, label } = parseCategoryLabel(category);
  const meta = getCategoryMeta(category);
  const all = await getActiveServers();
  const byScore = all.filter((s) => s.category === category).sort((a, b) => score(b) - score(a));

  // A category_sponsor_7d purchase pins its listing to #1 for the life of the
  // sponsorship — a hard pin ahead of score(), not a score nudge, since the
  // product promise is "the top spot," and lib/stripeCheckout.ts already
  // guarantees at most one active sponsor per category at a time.
  const now = Date.now();
  const sponsorIdx = byScore.findIndex(
    (s) => s.categorySponsorUntil && new Date(s.categorySponsorUntil).getTime() > now
  );
  const sponsor = sponsorIdx >= 0 ? byScore[sponsorIdx] : null;
  const inCategory = sponsor
    ? [sponsor, ...byScore.slice(0, sponsorIdx), ...byScore.slice(sponsorIdx + 1)]
    : byScore;

  const total = inCategory.length;
  const cards = inCategory.slice(0, MAX_CARDS);
  const topNames = inCategory.slice(0, 3).map((s) => parseServerName(s.name).displayName);

  const intro = categoryIntroCopy(category, total, topNames);
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
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `What are ${label} Model Context Protocol (MCP) servers?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Model Context Protocol (MCP) servers in the ${label} category allow AI assistants (such as Claude Desktop, Cursor, Windsurf, and Cline) to connect directly to ${label.toLowerCase()} tools, APIs, and databases without manual copy-pasting.`,
            },
          },
          {
            '@type': 'Question',
            name: `How do I connect a ${label} MCP server to Claude Desktop or Cursor?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `To install a ${label} MCP server, select your desired server from the directory, copy the JSON configuration snippet, and add it to your client config file (such as claude_desktop_config.json or .cursor/mcp.json).`,
            },
          },
          {
            '@type': 'Question',
            name: `Are ${label} MCP servers free to use?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Yes, all ${label} MCP servers listed in this directory are open-source and free to integrate into compatible Model Context Protocol clients.`,
            },
          },
        ],
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
        <section style={{ margin: '0 auto 2.5rem', maxWidth: '780px', textAlign: 'center' }}>
          {(meta.emoji || emoji) && (
            <div
              className="category-card-emoji"
              aria-hidden="true"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                fontSize: '2.25rem',
                background: `${meta.color}18`,
                borderColor: meta.borderTint || `${meta.color}40`,
                boxShadow: `0 4px 20px ${meta.color}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              {meta.emoji || emoji}
            </div>
          )}
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            <span className="text-brand-gradient">{total.toLocaleString()}</span> {label} MCP Servers
          </h1>
          <p className="text-lead" style={{ margin: '0 auto 1.5rem', textAlign: 'center' }}>
            {intro}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
            <Link href={`/browse?category=${encodeURIComponent(category)}`} className="btn btn-secondary">
              Open in interactive directory
            </Link>
            {(() => {
              const best = bestTopicForCategory(category);
              return best ? (
                <Link href={`/best/${best.slug}`} className="btn btn-secondary">
                  Best {best.title} servers →
                </Link>
              ) : null;
            })()}
          </div>
        </section>

        {/* Category Sponsor Header */}
        <CategorySponsorBanner
          categoryName={label}
          sponsor={
            sponsor
              ? {
                  id: sponsor.id,
                  name: parseServerName(sponsor.name).displayName,
                  until: new Date(sponsor.categorySponsorUntil as string | Date).toISOString(),
                }
              : null
          }
        />

        {/* Server grid */}
        {cards.length > 0 ? (
          <ul className="directory-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {cards.map((server) => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <li key={server.id}>
                <ImpressionBeacon serverId={server.id} surface="category_page">
                  <Card
                    href={`/mcp/${server.id}`}
                    className={`directory-card-uniform ${isFeaturedListing(server) ? 'directory-card-featured' : ''}`.trim()}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={44} />
                      <div className="directory-card-title-block" style={{ marginBottom: 0 }}>
                        <h2 className="directory-card-title-text" style={{ fontSize: '1.1rem' }}>
                          {displayName}
                        </h2>
                        {org && <div className="directory-card-org-text">{org}</div>}
                      </div>
                    </div>
                    <div className="directory-card-desc-block">
                      <SafeMarkdown content={server.description || 'No description provided.'} isInline />
                    </div>
                    <div className="directory-card-footer">
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
                        {isFeaturedListing(server) && (
                          <Badge variant="success" className="badge-featured">
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
                </ImpressionBeacon>
                </li>
              );
            })}
          </ul>
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
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {related.map((r) => (
                <li key={r.slug}>
                <Link
                  href={`/categories/${r.slug}`}
                  className="badge badge-link badge-category"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {r.emoji && <span aria-hidden="true">{r.emoji}</span>}
                  <span>{r.label}</span>
                  <span style={{ opacity: 0.6 }}>({r.count.toLocaleString()})</span>
                </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Query-Forward AEO/SEO Information Section */}
        <section style={{ marginTop: '4rem', paddingTop: '2.5rem', borderTop: '1px solid var(--border-color)' }}>
          <FaqSection
            title={`Frequently Asked Questions about ${label} MCP Servers`}
            items={[
              {
                question: `What are ${label} Model Context Protocol (MCP) servers?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    Model Context Protocol (MCP) servers in the <strong>{label}</strong> category allow AI assistants (such as Claude Desktop, Cursor, Windsurf, and Cline) to connect directly to {label.toLowerCase()} tools, APIs, and databases without manual copy-pasting.
                  </p>
                ),
              },
              {
                question: `How do I connect a ${label} MCP server to Claude Desktop or Cursor?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    To install a {label} MCP server, select your desired server from the directory, copy the JSON configuration snippet, and add it to your client config file (such as <code>claude_desktop_config.json</code> or <code>.cursor/mcp.json</code>).
                  </p>
                ),
              },
              {
                question: `Are ${label} MCP servers free to use?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    Yes, all {label} MCP servers listed in this directory are open-source and free to integrate into compatible Model Context Protocol clients.
                  </p>
                ),
              },
            ]}
          />
        </section>
      </main>
    </>
  );
}
