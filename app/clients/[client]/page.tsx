import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Eye, Heart, Download, BadgeCheck } from 'lucide-react';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { getActiveServers, type Server } from '../../../lib/servers';
import { engagementScore } from '../../../lib/search';
import { isVerifiedListing } from '../../../lib/featuredStatus';
import { parseServerName } from '../../../lib/displayName';
import { MCP_CLIENTS, mcpClientBySlug } from '../../../lib/clients';

const SITE = 'https://allmcps.com';
const TOP_N = 8;

// Rendered per request so the popular-servers list reflects live engagement from
// D1. The valid client set is small and fixed; invalid slugs 404 below.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ client: string }>;
}): Promise<Metadata> {
  const { client } = await params;
  const c = mcpClientBySlug(client);
  if (!c) return { title: 'Not Found' };
  const title = `How to Install MCP Servers in ${c.name}`;
  const url = `${SITE}/clients/${c.slug}`;
  return {
    title,
    description: c.lead,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: `${title} | AllMCPs`, description: c.lead, url },
    twitter: { card: 'summary_large_image', title: `${title} | AllMCPs`, description: c.lead },
  };
}

export default async function ClientPage({
  params,
}: {
  params: Promise<{ client: string }>;
}) {
  const { client } = await params;
  const c = mcpClientBySlug(client);
  if (!c) notFound();

  const all = await getActiveServers();
  const popular: Server[] = [...all].sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, TOP_N);

  const url = `${SITE}/clients/${c.slug}`;
  const heading = `How to Install MCP Servers in ${c.name}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HowTo',
        name: heading,
        description: c.lead,
        url,
        step: c.steps.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.title,
          text: s.body,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: c.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'MCP Clients', item: `${SITE}/clients` },
          { '@type': 'ListItem', position: 3, name: c.name, item: url },
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
            <li><Link href="/clients">MCP Clients</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">{c.name}</li>
          </ol>
        </nav>

        {/* Hero */}
        <section style={{ marginBottom: '2.5rem', maxWidth: '760px' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>{heading}</h1>
          <p className="text-lead" style={{ margin: 0 }}>{c.lead}</p>
        </section>

        {/* Config location */}
        <section style={{ marginBottom: '2.5rem', maxWidth: '760px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Where the config lives</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {c.configLocations.map((loc) => (
              <li key={loc.path} style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-color)', fontWeight: 700, minWidth: '7rem' }}>{loc.os}</span>
                <code style={{ fontSize: '0.85rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{loc.path}</code>
              </li>
            ))}
          </ul>
          <pre style={{ overflowX: 'auto', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--surface-color, #0f172a)', fontSize: '0.85rem', lineHeight: 1.5 }}>
            <code>{c.configExample}</code>
          </pre>
        </section>

        {/* Steps */}
        <section style={{ marginBottom: '3rem', maxWidth: '760px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>Step by step</h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {c.steps.map((s, i) => (
              <li key={s.title} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-color)', minWidth: '1.75rem', textAlign: 'center' }}>{i + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.35rem' }}>{s.title}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Popular servers to try */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>Popular MCP servers to try in {c.name}</h2>
          {popular.length > 0 ? (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {popular.map((server, i) => {
                const { displayName, org } = parseServerName(server.name);
                return (
                  <li key={server.id}>
                    <Link
                      href={`/mcp/${server.id}`}
                      className="surface-interactive"
                      style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '1.25rem', borderRadius: '12px', textDecoration: 'none', color: 'inherit', border: '1px solid var(--border-color)' }}
                    >
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-color)', minWidth: '2rem', textAlign: 'center', lineHeight: 1.4 }}>{i + 1}</div>
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
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45, marginTop: '0.35rem' }}>
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
              <p className="empty-state-body" style={{ margin: 0 }}>No servers to show yet.</p>
            </div>
          )}
        </section>

        {/* FAQ */}
        <section style={{ marginBottom: '3rem', maxWidth: '760px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>Frequently asked questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {c.faq.map((f) => (
              <div key={f.q}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>{f.q}</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Other clients */}
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>Install MCP servers in other clients</h2>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {MCP_CLIENTS.filter((o) => o.slug !== c.slug).map((o) => (
              <Link key={o.slug} href={`/clients/${o.slug}`} className="badge badge-link badge-category">
                {o.name}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
