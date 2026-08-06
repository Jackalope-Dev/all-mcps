import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Eye, Heart, Download } from 'lucide-react';
import { Badge } from '../../../../components/ui/Badge';
import { ServerAvatar } from '../../../../components/ui/ServerAvatar';
import { SafeMarkdown } from '../../../../components/ui/SafeMarkdown';
import { getServerById, getRelatedServers, type Server } from '../../../../lib/servers';
import { isFeaturedListing, isVerifiedListing } from '../../../../lib/featuredStatus';
import { parseServerName } from '../../../../lib/displayName';
import { categorySlug, parseCategoryLabel } from '../../../../lib/categories';

const SITE = 'https://allmcps.com';
const MAX = 12;

/** Keeps a display name/label short enough that the title or description stays inside the SEO budget. */
function truncateName(name: string, max: number): string {
  if (name.length <= max) return name;
  return `${name.slice(0, Math.max(6, max - 1)).trimEnd()}…`;
}

/** Builds "Alternatives to X — MCP Servers", dropping the suffix once the name runs long. */
function buildAltTitle(displayName: string): string {
  const name = truncateName(displayName, 30);
  const base = `Alternatives to ${name}`;
  const withSuffix = `${base} — MCP Servers`;
  return withSuffix.length <= 50 ? withSuffix : base;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const server = await getServerById(id);
  if (!server) return { title: 'Not Found', robots: { index: false } };
  const { displayName } = parseServerName(server.name);
  const title = buildAltTitle(displayName);
  const rawDescription = `Compare the best alternatives to the ${displayName} MCP server. Similar Model Context Protocol tools in ${parseCategoryLabel(server.category).label}, ranked by usage, with install commands.`;
  const description =
    rawDescription.length > 157 ? `${rawDescription.slice(0, 154)}...` : rawDescription;
  const url = `${SITE}/mcp/${server.id}/alternatives`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: `${title} | AllMCPs`, description, url },
    twitter: { card: 'summary_large_image', title: `${title} | AllMCPs`, description },
  };
}

function StatRow({ s }: { s: Server }) {
  return (
    <div style={{ display: 'flex', gap: '0.85rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <Eye size={13} /> {(s.views || 0).toLocaleString()}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <Download size={13} /> {(s.copies || 0).toLocaleString()}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <Heart size={13} /> {(s.upvotes || 0).toLocaleString()}
      </span>
    </div>
  );
}

export default async function AlternativesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServerById(id);
  if (!server) notFound();

  const { displayName } = parseServerName(server.name);
  const { label: categoryLabel } = parseCategoryLabel(server.category);
  const alternatives = await getRelatedServers(server, MAX);
  const url = `${SITE}/mcp/${server.id}/alternatives`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `Alternatives to ${displayName}`,
        description: `The best alternatives to the ${displayName} MCP server, ranked by usage.`,
        url,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: alternatives.length,
          itemListElement: alternatives.map((s, i) => ({
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
          { '@type': 'ListItem', position: 2, name: 'Browse', item: `${SITE}/browse` },
          { '@type': 'ListItem', position: 3, name: displayName, item: `${SITE}/mcp/${server.id}` },
          { '@type': 'ListItem', position: 4, name: 'Alternatives', item: url },
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
            <li><Link href="/browse">Browse</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href={`/mcp/${server.id}`}>{displayName}</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">Alternatives</li>
          </ol>
        </nav>

        {/* Hero */}
        <section style={{ marginBottom: '2.5rem', maxWidth: '760px' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Alternatives to {displayName}
          </h1>
          <p className="text-lead" style={{ margin: '0 0 1rem' }}>
            {alternatives.length > 0 ? (
              <>
                Looking for a different {categoryLabel} MCP server? These {alternatives.length} tools offer
                similar capabilities to <Link href={`/mcp/${server.id}`}>{displayName}</Link> — compare their
                usage and install any of them in seconds.
              </>
            ) : (
              <>
                We don&rsquo;t have close alternatives to <Link href={`/mcp/${server.id}`}>{displayName}</Link>{' '}
                catalogued yet. Explore more {categoryLabel} servers in the directory.
              </>
            )}
          </p>
          <Link href={`/categories/${categorySlug(server.category)}`} className="btn btn-secondary">
            All {categoryLabel} servers →
          </Link>
        </section>

        {/* Alternatives grid */}
        {alternatives.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {alternatives.map((alt) => {
              const altName = parseServerName(alt.name).displayName;
              const featured = isFeaturedListing(alt);
              return (
                <li
                  key={alt.id}
                  className="surface-interactive"
                  style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    border: featured ? '1px solid rgba(var(--accent-rgb), 0.4)' : '1px solid var(--border-color)',
                    background: featured
                      ? 'linear-gradient(135deg, rgba(var(--accent-rgb),0.06), rgba(var(--accent-secondary-rgb),0.04))'
                      : undefined,
                  }}
                >
                  <Link
                    href={`/mcp/${alt.id}`}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                        <ServerAvatar name={alt.name} logoUrl={alt.logoUrl} size={32} />
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {altName}
                        </span>
                      </div>
                      {featured ? (
                        <Badge variant="success" className="badge-featured" style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                          ★ Featured
                        </Badge>
                      ) : isVerifiedListing(alt) ? (
                        <Badge variant="official" style={{ fontSize: '0.65rem', flexShrink: 0 }}>Verified</Badge>
                      ) : null}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 }}>
                      <SafeMarkdown content={alt.description || 'No description provided.'} isInline />
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                      <Badge variant="category" style={{ fontSize: '0.7rem' }}>{alt.category}</Badge>
                      <StatRow s={alt} />
                    </div>
                  </Link>
                  <Link
                    href={`/mcp/${server.id}/vs/${alt.id}`}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'var(--accent-color)',
                      textDecoration: 'none',
                      paddingTop: '0.35rem',
                      borderTop: '1px solid var(--border-color)',
                    }}
                  >
                    Compare side-by-side →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
