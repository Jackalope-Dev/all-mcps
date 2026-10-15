import { ArrowRight, BadgeCheck, ChevronDown, Download } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serializeJsonLd } from '@/lib/jsonLd';
import { ServerStats } from '../../../components/directory/ServerRow';
import { InlineMarkdown } from '../../../components/ui/InlineMarkdown';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import {
  BEST_TOPICS,
  bestTopicBySlug,
  bestTopicHue,
  selectServersForTopic,
} from '../../../lib/bestTopics';
import { parseServerName } from '../../../lib/displayName';
import {
  isFeaturedListing,
  isVerifiedListing,
} from '../../../lib/featuredStatus';
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
  // #1 is gold (amber); #2–#3 carry the topic's own hue.
  const topicHue = bestTopicHue(t);
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

  // Curated relations first (e.g. marketing <-> seo) — these disambiguate
  // adjacent-intent topics that would otherwise silently split relevance
  // signals for the same head term — then backfill to 8 with the rest.
  const relatedCurated = (t.relatedTopicSlugs ?? [])
    .map((slug) => bestTopicBySlug(slug))
    .filter(
      (o): o is NonNullable<typeof o> => Boolean(o) && o?.slug !== t.slug,
    );
  const relatedSlugs = new Set(relatedCurated.map((o) => o.slug));
  const relatedTopics = [
    ...relatedCurated,
    ...BEST_TOPICS.filter(
      (o) => o.slug !== t.slug && !relatedSlugs.has(o.slug),
    ),
  ].slice(0, 8);

  const browseAll = t.categorySlug
    ? { href: `/categories/${t.categorySlug}`, rel: undefined }
    : {
        href: `/browse?q=${encodeURIComponent(t.match?.[0] || t.title)}`,
        rel: 'nofollow',
      };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="container dir-catpage">
        <nav aria-label="Breadcrumb">
          <ol className="crumbs">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/best">Best MCP servers</Link>
            </li>
            <li aria-current="page">{t.title}</li>
          </ol>
        </nav>

        <header className="dir-page-head dir-best-head animate-in">
          <h1 className="text-page-title">
            {heading} <span className="dir-best-year">({year})</span>
          </h1>
          <p className="text-lead">{t.lead}</p>
          <p className="dir-best-meta">
            Top {ranked.length} · ranked by installs, upvotes, stars and views ·
            refreshed hourly
          </p>
        </header>

        <div className="dir-best-layout">
          {ranked.length > 0 ? (
            <ol className="dir-ranked">
              {ranked.map((server, i) => {
                const { displayName, org } = parseServerName(server.name);
                const verified = isVerifiedListing(server);
                return (
                  <li key={server.id}>
                    <article
                      id={`rank-${i + 1}`}
                      className={`dir-rank spotlight${i === 0 ? ' is-first hue-amber' : i < 3 ? ` is-podium hue-${topicHue}` : ''}`}
                    >
                      <span className="dir-rank-num tabular" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="dir-rank-main">
                        <div className="dir-rank-head">
                          <ServerAvatar
                            name={server.name}
                            logoUrl={server.logoUrl}
                            category={server.category}
                            size={i === 0 ? 48 : 40}
                          />
                          <div className="dir-rank-titles">
                            <h2 className="dir-rank-name">
                              <Link
                                href={`/mcp/${server.id}`}
                                className="dir-rank-link"
                              >
                                <span className="sr-only">#{i + 1} </span>
                                {displayName}
                              </Link>
                            </h2>
                            <div className="dir-rank-sub">
                              {org && (
                                <span className="dir-row-org">{org}</span>
                              )}
                              {verified && (
                                <span className="dir-flag dir-flag--verified">
                                  <BadgeCheck size={13} aria-hidden="true" />
                                  {server.isOfficial ? 'Official' : 'Verified'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="dir-rank-why">
                          <span className="dir-rank-why-label">
                            Why it&rsquo;s here
                          </span>
                          {reasonFor(server, i)}
                        </p>
                        <p className="dir-rank-desc">
                          <InlineMarkdown
                            content={
                              server.description || 'No description provided.'
                            }
                          />
                        </p>
                        <div className="dir-rank-foot">
                          <ServerStats server={server} />
                          <Link
                            href={`/mcp/${server.id}#quick-install`}
                            className={`btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-secondary'} dir-rank-cta`}
                          >
                            <Download size={14} aria-hidden="true" />
                            Install
                          </Link>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="dir-empty">
              <h2 className="dir-empty-title">No servers ranked yet</h2>
              <p className="dir-empty-body">
                Nothing in the directory matches this topic yet.
              </p>
              <div className="dir-empty-actions">
                <Link href="/submit" className="btn btn-secondary btn-sm">
                  Submit a server
                </Link>
              </div>
            </div>
          )}

          <aside className="dir-best-aside" aria-label="About this list">
            <div className="dir-best-card">
              <h2 className="dir-best-card-title">How this list is ranked</h2>
              <p>
                Servers are scored on real usage in the AllMCPs directory —
                installs, community upvotes, GitHub stars and views — and the
                list refreshes every hour.
              </p>
              {ranked.length > 0 && (
                <ol className="dir-best-index">
                  {ranked.map((s, i) => (
                    <li key={s.id}>
                      <a href={`#rank-${i + 1}`}>
                        <span className="dir-best-index-n tabular">
                          {i + 1}
                        </span>
                        <span className="dir-best-index-name">
                          {parseServerName(s.name).displayName}
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
              <Link
                href={browseAll.href}
                rel={browseAll.rel}
                className="btn btn-secondary btn-sm dir-best-all"
              >
                Browse all {t.title} servers
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>

        <div className="dir-best-guide">
          <section className="dir-section" aria-labelledby="which-one">
            <h2 id="which-one" className="dir-section-title">
              Which {t.title} MCP server should you use?
            </h2>
            <div className="dir-prose">
              {t.guidance && t.guidance.length > 0 ? (
                t.guidance.map((p) => <p key={p}>{p}</p>)
              ) : (
                <p>
                  When choosing a Model Context Protocol server for{' '}
                  <strong>{t.title}</strong>, select verified or official
                  listings if you need strict API security guarantees. For rapid
                  local dev testing with Claude or Cursor, community-maintained
                  tools offer zero-setup configuration blocks ready to
                  copy-paste.
                </p>
              )}
            </div>
          </section>

          <section className="dir-section" aria-labelledby="best-faq">
            <h2 id="best-faq" className="dir-section-title">
              Frequently asked questions about {t.title} MCP servers
            </h2>
            <div className="dir-faq-list">
              {t.faq.map((f, i) => (
                <details key={f.q} className="dir-faq-item" open={i === 0}>
                  <summary>
                    <h3>{f.q}</h3>
                    <ChevronDown
                      size={16}
                      className="dir-facet-chevron"
                      aria-hidden="true"
                    />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <section className="dir-section" aria-labelledby="more-guides">
          <h2 id="more-guides" className="dir-section-title dir-more-title">
            More best-of guides
          </h2>
          <ul className="dir-chip-list">
            {relatedTopics.map((o) => (
              <li key={o.slug}>
                <Link href={`/best/${o.slug}`} className="chip">
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
