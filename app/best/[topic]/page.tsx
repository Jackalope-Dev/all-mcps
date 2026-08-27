import { BadgeCheck, ChevronRight, Download, Eye, Heart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IconTooltip } from '../../../components/ui/IconTooltip';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import {
  BEST_TOPICS,
  bestTopicBySlug,
  selectServersForTopic,
} from '../../../lib/bestTopics';
import { parseServerName } from '../../../lib/displayName';
import {
  isFeaturedListing,
  isVerifiedListing,
} from '../../../lib/featuredStatus';
import { formatCompactNumber } from '../../../lib/format';
import { engagementScore } from '../../../lib/search';
import { getServersForTopic, type Server } from '../../../lib/servers';

const SITE = 'https://allmcps.com';
const TOP_N = 10;

// ISR instead of force-dynamic: the topic set is small and fixed (50 curated
// topics), so pre-rendering all of them and refreshing hourly keeps rankings
// close to live without re-scanning and re-parsing the entire ~3k-listing
// catalog from D1 on every single visitor request.
export const revalidate = 3600;

export function generateStaticParams() {
  return BEST_TOPICS.map((t) => ({ topic: t.slug }));
}

/** Builds "Best {topic} MCP Servers (year)", trimming the year first and the topic
 * name second so the rendered title (this + " | AllMCPs") stays within budget even
 * for the longest curated topic titles (e.g. "Multimedia & Media Processing"). */
function buildBestTitle(topicTitle: string, year: number): string {
  const base = `Best ${topicTitle} MCP Servers`;
  const withYear = `${base} (${year})`;
  if (withYear.length <= 50) return withYear;
  if (base.length <= 50) return base;
  const fixedLen = 'Best  MCP Servers'.length;
  const maxTopicLen = Math.max(6, 50 - fixedLen - 1);
  const shortTopic = `${topicTitle.slice(0, maxTopicLen).trimEnd()}…`;
  return `Best ${shortTopic} MCP Servers`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const t = bestTopicBySlug(topic);
  if (!t) return { title: 'Not Found' };
  const year = new Date().getFullYear();
  const title = buildBestTitle(t.title, year);
  const description =
    t.lead.length > 157 ? `${t.lead.slice(0, 154).trimEnd()}...` : t.lead;
  const url = `${SITE}/best/${t.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
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
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AllMCPs`,
      description,
    },
  };
}

/** A short, factual reason each server earns its rank — no invented claims. */
function reasonFor(server: Server, index: number): string {
  if (index === 0) return 'Most popular in this category on AllMCPs';
  if (isFeaturedListing(server)) return 'Featured listing';
  if (server.isOfficial) return 'Official server';
  const bits: string[] = [];
  if (server.copies) bits.push(`${server.copies.toLocaleString()} installs`);
  if (server.upvotes) bits.push(`${server.upvotes.toLocaleString()} upvotes`);
  return bits.length ? `Popular pick — ${bits.join(', ')}` : 'Community pick';
}

export default async function BestTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const t = bestTopicBySlug(topic);
  if (!t) notFound();

  const all = await getServersForTopic(t);
  const ranked = selectServersForTopic(t, all)
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, TOP_N);

  const year = new Date().getFullYear();
  const url = `${SITE}/best/${t.slug}`;
  const heading = `Best MCP Servers for ${t.title}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${heading} (${year})`,
        description: t.lead,
        url,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: ranked.length,
          itemListElement: ranked.map((s, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE}/mcp/${s.id}`,
            name: s.name,
          })),
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: t.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Best MCP Servers',
            item: `${SITE}/best`,
          },
          { '@type': 'ListItem', position: 3, name: t.title, item: url },
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
              <Link href="/best">Best MCP Servers</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">{t.title}</li>
          </ol>
        </nav>

        {/* Hero */}
        <section
          style={{
            marginBottom: '2.5rem',
            maxWidth: '760px',
            margin: '0 auto 2.5rem',
            textAlign: 'center',
          }}
        >
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            {heading}{' '}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              ({year})
            </span>
          </h1>
          <p
            className="text-lead"
            style={{ margin: '0 auto 1.25rem', textAlign: 'center' }}
          >
            {t.lead}
          </p>
          {t.categorySlug ? (
            <Link
              href={`/categories/${t.categorySlug}`}
              className="btn btn-secondary"
            >
              Browse all {t.title} servers →
            </Link>
          ) : (
            <Link
              href={`/browse?q=${encodeURIComponent(t.match?.[0] || t.title)}`}
              className="btn btn-secondary"
              rel="nofollow"
            >
              Browse all {t.title} servers →
            </Link>
          )}
        </section>

        {/* Ranked list */}
        {ranked.length > 0 ? (
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {ranked.map((server, i) => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <li key={server.id}>
                  <Link
                    href={`/mcp/${server.id}`}
                    className="surface-interactive"
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'flex-start',
                      padding: '1.25rem',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      color: 'inherit',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: 'var(--accent-color)',
                        minWidth: '2rem',
                        textAlign: 'center',
                        lineHeight: 1.4,
                      }}
                    >
                      {i + 1}
                    </div>
                    <ServerAvatar
                      name={server.name}
                      logoUrl={server.logoUrl}
                      size={44}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '1.05rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {displayName}
                        </span>
                        {org && (
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {org}
                          </span>
                        )}
                        {isVerifiedListing(server) && (
                          <IconTooltip
                            label="Verified listing"
                            asSpan
                            trigger={
                              <span
                                style={{
                                  display: 'inline-flex',
                                  cursor: 'pointer',
                                }}
                              >
                                <BadgeCheck
                                  size={15}
                                  style={{ color: 'var(--accent-color)' }}
                                />
                              </span>
                            }
                          >
                            <span className="mcp-icon-tooltip-title">
                              <BadgeCheck
                                size={14}
                                color="var(--accent-color)"
                              />{' '}
                              Verified Listing
                            </span>
                            <span className="mcp-icon-tooltip-body">
                              Ownership or active status confirmed on AllMCPs.
                            </span>
                          </IconTooltip>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: 'var(--accent-color)',
                          margin: '0.35rem 0',
                          fontWeight: 700,
                        }}
                      >
                        {reasonFor(server, i)}
                      </div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.45,
                        }}
                      >
                        <SafeMarkdown
                          content={
                            server.description || 'No description provided.'
                          }
                          isInline
                        />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.85rem',
                          color: 'var(--text-secondary)',
                          fontSize: '0.8rem',
                          marginTop: '0.6rem',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                          title={`${(server.views || 0).toLocaleString()} views`}
                        >
                          <Eye size={13} />{' '}
                          {formatCompactNumber(server.views || 0)}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                          title={`${(server.copies || 0).toLocaleString()} installs`}
                        >
                          <Download size={13} />{' '}
                          {formatCompactNumber(server.copies || 0)}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                          title={`${(server.upvotes || 0).toLocaleString()} upvotes`}
                        >
                          <Heart size={13} />{' '}
                          {formatCompactNumber(server.upvotes || 0)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div
            className="surface empty-state"
            style={{ borderStyle: 'dashed' }}
          >
            <p className="empty-state-body" style={{ margin: 0 }}>
              No servers listed for this topic yet.
            </p>
          </div>
        )}

        {/* Query-Forward Selection Guide */}
        <section style={{ marginTop: '3.5rem', maxWidth: '760px' }}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '1rem',
            }}
          >
            Which {t.title} MCP server should you use?
          </h2>
          <div
            className="surface"
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              marginBottom: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {t.guidance && t.guidance.length > 0 ? (
              t.guidance.map((p, i) => (
                <p
                  key={i}
                  style={{
                    margin: 0,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  {p}
                </p>
              ))
            ) : (
              <p
                style={{
                  margin: 0,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                When choosing a Model Context Protocol server for{' '}
                <strong>{t.title}</strong>, select verified or official listings
                if you need strict API security guarantees. For rapid local dev
                testing with Claude or Cursor, community-maintained tools offer
                zero-setup configuration blocks ready to copy-paste.
              </p>
            )}
          </div>

          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '1.25rem',
            }}
          >
            Frequently asked questions about {t.title} MCP servers
          </h2>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {t.faq.map((f) => (
              <div
                key={f.q}
                className="surface"
                style={{ padding: '1.25rem', borderRadius: '12px' }}
              >
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    marginTop: 0,
                    marginBottom: '0.35rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {f.q}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Related best-of pages */}
        <section style={{ marginTop: '3.5rem' }}>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1.25rem',
            }}
          >
            More best-of guides
          </h2>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              gap: '0.6rem',
              flexWrap: 'wrap',
            }}
          >
            {(() => {
              // Curated relations first (e.g. marketing <-> seo) — these disambiguate
              // adjacent-intent topics that would otherwise silently split relevance
              // signals for the same head term — then backfill to 8 with the rest.
              const related = (t.relatedTopicSlugs ?? [])
                .map((slug) => bestTopicBySlug(slug))
                .filter(
                  (o): o is NonNullable<typeof o> =>
                    Boolean(o) && o!.slug !== t.slug,
                );
              const relatedSlugs = new Set(related.map((o) => o.slug));
              const rest = BEST_TOPICS.filter(
                (o) => o.slug !== t.slug && !relatedSlugs.has(o.slug),
              );
              return [...related, ...rest].slice(0, 8);
            })().map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/best/${o.slug}`}
                  className="badge badge-link badge-category"
                >
                  Best for {o.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
