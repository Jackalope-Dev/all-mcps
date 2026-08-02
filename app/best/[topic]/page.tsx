import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Eye, Heart, Download, BadgeCheck } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { getActiveServers, type Server } from '../../../lib/servers';
import { engagementScore } from '../../../lib/search';
import { categoryFromSlug } from '../../../lib/categories';
import { BEST_TOPICS, bestTopicBySlug } from '../../../lib/bestTopics';
import { isFeaturedListing, isVerifiedListing } from '../../../lib/featuredStatus';
import { parseServerName } from '../../../lib/displayName';

const SITE = 'https://allmcps.com';
const TOP_N = 10;

// Rendered per request so the ranking reflects live engagement from D1 (the
// static build has no D1, so prerendering would bake in an unranked order). The
// valid topic set is small and fixed; invalid slugs 404 via notFound below.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const t = bestTopicBySlug(topic);
  if (!t) return { title: 'Not Found' };
  const year = new Date().getFullYear();
  const title = `Best MCP Servers for ${t.title} (${year})`;
  const url = `${SITE}/best/${t.slug}`;
  return {
    title,
    description: t.lead,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: `${title} | AllMCPs`, description: t.lead, url },
    twitter: { card: 'summary_large_image', title: `${title} | AllMCPs`, description: t.lead },
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

  const category = categoryFromSlug(t.categorySlug);
  const all = await getActiveServers();
  const ranked = (category ? all.filter((s) => s.category === category) : [])
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
          { '@type': 'ListItem', position: 2, name: 'Best MCP Servers', item: `${SITE}/best` },
          { '@type': 'ListItem', position: 3, name: t.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container page-shell" style={{ paddingBottom: '4rem' }}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '2rem' }}>
            <li><Link href="/">Home</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href="/best">Best MCP Servers</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">{t.title}</li>
          </ol>
        </nav>

        {/* Hero */}
        <section style={{ marginBottom: '2.5rem', maxWidth: '760px' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            {heading} <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>({year})</span>
          </h1>
          <p className="text-lead" style={{ margin: '0 0 1rem' }}>{t.lead}</p>
          {category && (
            <Link href={`/categories/${t.categorySlug}`} className="btn btn-secondary">
              Browse all {t.title} servers →
            </Link>
          )}
        </section>

        {/* Ranked list */}
        {ranked.length > 0 ? (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {ranked.map((server, i) => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <li key={server.id}>
                  <Link
                    href={`/mcp/${server.id}`}
                    className="surface-interactive"
                    style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '1.25rem', borderRadius: '12px', textDecoration: 'none', color: 'inherit', border: '1px solid var(--border-color)' }}
                  >
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-color)', minWidth: '2rem', textAlign: 'center', lineHeight: 1.4 }}>
                      {i + 1}
                    </div>
                    <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={44} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{displayName}</span>
                        {org && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{org}</span>}
                        {isVerifiedListing(server) && (
                          <span title="Verified" style={{ display: 'inline-flex' }}>
                            <BadgeCheck size={15} style={{ color: 'var(--accent-color)' }} />
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-color)', margin: '0.35rem 0', fontWeight: 700 }}>
                        {reasonFor(server, i)}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 }}>
                        <SafeMarkdown content={server.description || 'No description provided.'} isInline />
                      </div>
                      <div style={{ display: 'flex', gap: '0.85rem', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.6rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Eye size={13} /> {(server.views || 0).toLocaleString()}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Download size={13} /> {(server.copies || 0).toLocaleString()}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Heart size={13} /> {(server.upvotes || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="surface empty-state" style={{ borderStyle: 'dashed' }}>
            <p className="empty-state-body" style={{ margin: 0 }}>No servers listed for this topic yet.</p>
          </div>
        )}

        {/* Query-Forward Selection Guide */}
        <section style={{ marginTop: '3.5rem', maxWidth: '760px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
            Which {t.title} MCP server should you use?
          </h2>
          <div className="surface" style={{ padding: '1.5rem', borderRadius: '12px', marginBottom: '2.5rem' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              When choosing a Model Context Protocol server for <strong>{t.title}</strong>, select verified or official listings if you need strict API security guarantees. For rapid local dev testing with Claude or Cursor, community-maintained tools offer zero-setup configuration blocks ready to copy-paste.
            </p>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>
            Frequently asked questions about {t.title} MCP servers
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {t.faq.map((f) => (
              <div key={f.q} className="surface" style={{ padding: '1.25rem', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 0, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>{f.q}</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related best-of pages */}
        <section style={{ marginTop: '3.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>More best-of guides</h2>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {BEST_TOPICS.filter((o) => o.slug !== t.slug).slice(0, 8).map((o) => (
              <Link key={o.slug} href={`/best/${o.slug}`} className="badge badge-link badge-category">
                Best for {o.title}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
