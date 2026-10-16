import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getHubCounts, isCategoryHubIndexable } from '@/lib/hubIndexability';
import { serializeJsonLd } from '@/lib/jsonLd';
import { SponsorAdUnit } from '../../../components/ads/SponsorAdUnit';
import { ServerCard, ServerRow } from '../../../components/directory/ServerRow';
import { ImpressionBeacon } from '../../../components/ImpressionTracker';
import { FaqSection } from '../../../components/ui/FaqSection';
import { bestTopicForCategory } from '../../../lib/bestTopics';
import {
  categoryFromSlug,
  categoryIntroCopy,
  categorySlug,
  DIRECTORY_CATEGORIES,
  getCategoryMeta,
  parseCategoryLabel,
} from '../../../lib/categories';
import { parseServerName } from '../../../lib/displayName';
import {
  getCategoryCounts,
  getRankingCandidates,
  relatedRankingScore,
  type Server,
} from '../../../lib/servers';

const SITE = 'https://allmcps.com';

/** Cap the server-rendered card list; larger categories link out to the full filter view. */
const MAX_CARDS = 60;
/** Leading servers shown as "top picks" cards above the list. */
const TOP_PICKS = 3;
/** Row index of the in-feed sponsor unit in the list below the picks. */
const AD_ROW_INDEX = 2;

/** Ranking mirrors lib/servers.relatedRankingScore so ordering is consistent site-wide. */
function score(s: Server): number {
  return relatedRankingScore(s);
}

// Without a revalidate window this page is fully static (baked in at build/deploy
// time only) — fine for content, but rankings/counts go stale between deploys.
// Hourly ISR keeps it current without re-scanning the catalog on every request.
export const revalidate = 3600;

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
    rawDescription.length > 157
      ? `${rawDescription.slice(0, 154)}...`
      : rawDescription;
  const url = `${SITE}/categories/${canonicalSlug}`;
  const indexable = isCategoryHubIndexable(category, await getHubCounts());
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
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
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AllMCPs`,
      description,
    },
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
    permanentRedirect(`/categories/${canonicalSlug}`);
  }

  const { label } = parseCategoryLabel(category);
  const meta = getCategoryMeta(category);

  const [categoryServers, countsObj] = await Promise.all([
    getRankingCandidates({ category }),
    getCategoryCounts(),
  ]);
  const byScore = [...categoryServers].sort((a, b) => score(b) - score(a));

  // A category_sponsor_7d purchase pins its listing to #1 for the life of the
  // sponsorship — a hard pin ahead of score(), not a score nudge, since the
  // product promise is "the top spot," and lib/stripeCheckout.ts already
  // guarantees at most one active sponsor per category at a time.
  const now = Date.now();
  const sponsorIdx = byScore.findIndex(
    (s) =>
      s.categorySponsorUntil &&
      new Date(s.categorySponsorUntil).getTime() > now,
  );
  const sponsor = sponsorIdx >= 0 ? byScore[sponsorIdx] : null;
  const inCategory = sponsor
    ? [
        sponsor,
        ...byScore.slice(0, sponsorIdx),
        ...byScore.slice(sponsorIdx + 1),
      ]
    : byScore;

  const total = inCategory.length;
  const cards = inCategory.slice(0, MAX_CARDS);
  const topNames = inCategory
    .slice(0, 3)
    .map((s) => parseServerName(s.name).displayName);

  const intro = categoryIntroCopy(category, total, topNames);
  const url = `${SITE}/categories/${slug}`;

  // Sibling categories for cross-linking, most-populated first.
  const related = Object.entries(countsObj)
    .filter(([name]) => name !== category)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 9)
    .map(([name, count]) => ({
      name,
      count,
      ...parseCategoryLabel(name),
      slug: categorySlug(name),
    }));

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
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Categories',
            item: `${SITE}/categories`,
          },
          { '@type': 'ListItem', position: 3, name: label, item: url },
        ],
      },
    ],
  };
  const picks = cards.slice(0, TOP_PICKS);
  const rest = cards.slice(TOP_PICKS);
  const best = bestTopicForCategory(category);
  const browseHref = `/browse?category=${encodeURIComponent(category)}`;

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
              <Link href="/categories">Categories</Link>
            </li>
            <li aria-current="page">{label}</li>
          </ol>
        </nav>

        <header className={`dir-hero animate-in hue-${meta.hue}`}>
          <span className="dir-hero-icon" aria-hidden="true">
            {meta.emoji}
          </span>
          <div className="dir-hero-body">
            <h1 className="text-page-title">{label} MCP servers</h1>
            <p className="dir-hero-lead">{intro}</p>
            <div className="dir-hero-actions">
              <Link
                href={browseHref}
                className="btn btn-primary btn-md"
                rel="nofollow"
              >
                Search &amp; filter all {total.toLocaleString()}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              {best && (
                <Link
                  href={`/best/${best.slug}`}
                  className="btn btn-secondary btn-md"
                >
                  Best {best.title} servers
                </Link>
              )}
            </div>
          </div>
        </header>

        {cards.length > 0 ? (
          <>
            {/* Directly under the heading so the sponsor is in the first
                screen (impressions count at ≥50% visible). */}
            <div className="dir-banner">
              <SponsorAdUnit placement="header_banner" />
            </div>

            <section className="dir-section" aria-labelledby="top-picks">
              <div className="dir-section-head">
                <h2 id="top-picks" className="dir-section-title">
                  Top picks
                </h2>
                <p className="dir-section-sub">
                  The most-used {label} servers on AllMCPs right now.
                </p>
              </div>
              <ol className="dir-picks">
                {picks.map((server, i) => (
                  <li key={server.id} className="dir-pick">
                    <span className="dir-pick-rank tabular" aria-hidden="true">
                      #{i + 1}
                    </span>
                    <ImpressionBeacon
                      serverId={server.id}
                      surface="category_page"
                      className="dir-beacon dir-pick-beacon"
                    >
                      <ServerCard server={server} hideCategory />
                    </ImpressionBeacon>
                  </li>
                ))}
              </ol>
            </section>

            {rest.length > 0 && (
              <section className="dir-section" aria-labelledby="all-servers">
                <div className="dir-section-head dir-section-head--split">
                  <h2 id="all-servers" className="dir-section-title">
                    More {label} servers
                  </h2>
                  <Link href={browseHref} className="link-arrow" rel="nofollow">
                    Filter by client, language &amp; more
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
                <ol className="dir-list dir-list--plain">
                  {rest.map((server, index) => (
                    <li key={server.id}>
                      {index === AD_ROW_INDEX && (
                        <div className="dir-ad-slot">
                          <SponsorAdUnit
                            placement="directory_inline"
                            layout="row"
                          />
                        </div>
                      )}
                      <ImpressionBeacon
                        serverId={server.id}
                        surface="category_page"
                      >
                        <ServerRow server={server} hideCategory />
                      </ImpressionBeacon>
                    </li>
                  ))}
                </ol>
                {total > cards.length && (
                  <div className="dir-more">
                    <span className="dir-more-meta tabular">
                      Showing {cards.length} of {total.toLocaleString()}
                    </span>
                    <Link
                      href={browseHref}
                      className="btn btn-secondary btn-md"
                      rel="nofollow"
                    >
                      Browse all {total.toLocaleString()} {label} servers
                    </Link>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <div className="dir-empty">
            <h2 className="dir-empty-title">No servers here yet</h2>
            <p className="dir-empty-body">
              Nothing is listed in {label} yet. Know a good one?
            </p>
            <div className="dir-empty-actions">
              <Link href="/submit" className="btn btn-secondary btn-sm">
                Submit a server
              </Link>
            </div>
          </div>
        )}

        {related.length > 0 && (
          <section className="dir-section" aria-labelledby="related-cats">
            <div className="dir-section-head">
              <h2 id="related-cats" className="dir-section-title">
                Related categories
              </h2>
            </div>
            <ul className="dir-catgrid dir-catgrid--compact">
              {related.map((r) => {
                const rMeta = getCategoryMeta(r.name);
                return (
                  <li key={r.slug}>
                    <Link
                      href={`/categories/${r.slug}`}
                      className={`dir-catcard spotlight tint-card hue-${rMeta.hue}`}
                    >
                      <div className="dir-catcard-head">
                        <span className="dir-catcard-icon" aria-hidden="true">
                          {rMeta.emoji}
                        </span>
                        <div className="dir-catcard-titles">
                          <h3 className="dir-catcard-title">{r.label}</h3>
                          <span className="dir-catcard-count tabular">
                            {r.count.toLocaleString()} servers
                          </span>
                        </div>
                        <ArrowUpRight
                          size={16}
                          className="dir-catcard-arrow"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="dir-section dir-faq">
          <FaqSection
            title={`Frequently Asked Questions about ${label} MCP Servers`}
            renderJsonLd={false}
            items={[
              {
                question: `What are ${label} Model Context Protocol (MCP) servers?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    Model Context Protocol (MCP) servers in the{' '}
                    <strong>{label}</strong> category allow AI assistants (such
                    as Claude Desktop, Cursor, Windsurf, and Cline) to connect
                    directly to {label.toLowerCase()} tools, APIs, and databases
                    without manual copy-pasting.
                  </p>
                ),
              },
              {
                question: `How do I connect a ${label} MCP server to Claude Desktop or Cursor?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    To install a {label} MCP server, select your desired server
                    from the directory, copy the JSON configuration snippet, and
                    add it to your client config file (such as{' '}
                    <code>claude_desktop_config.json</code> or{' '}
                    <code>.cursor/mcp.json</code>).
                  </p>
                ),
              },
              {
                question: `Are ${label} MCP servers free to use?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    Yes, all {label} MCP servers listed in this directory are
                    open-source and free to integrate into compatible Model
                    Context Protocol clients.
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
