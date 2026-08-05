import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Eye, Heart, Download, BadgeCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { Badge } from '../../../components/ui/Badge';
import { getActiveServers, type Server } from '../../../lib/servers';
import { engagementScore } from '../../../lib/search';
import { isVerifiedListing } from '../../../lib/featuredStatus';
import { parseServerName } from '../../../lib/displayName';
import { MCP_CLIENTS, mcpClientBySlug } from '../../../lib/clients';
import { ClientConfigSection } from '../../../components/clients/ClientConfigSection';
import { ServerConfigCopyButton } from '../../../components/clients/ServerConfigCopyButton';
import { ClientFaqAccordion } from '../../../components/clients/ClientFaqAccordion';

const SITE = 'https://allmcps.com';
const TOP_N = 8;

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

  const hasDedicatedLandingPage = ['claude-desktop', 'cursor', 'cline', 'windsurf'].includes(c.slug);
  const dedicatedLandingSlug = c.slug === 'claude-desktop' ? 'mcp-for-claude-desktop'
    : c.slug === 'cursor' ? 'mcp-for-cursor'
    : c.slug === 'cline' ? 'mcp-for-cline'
    : c.slug === 'windsurf' ? 'mcp-for-windsurf'
    : null;

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
        <section style={{ marginBottom: '2.5rem', maxWidth: '800px' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
            <Badge variant="verified">{c.badgeText}</Badge>
            {hasDedicatedLandingPage && dedicatedLandingSlug && (
              <Link href={`/${dedicatedLandingSlug}`} className="badge badge-link badge-category" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                Browse {c.name} Servers Directory <ArrowRight size={12} />
              </Link>
            )}
          </div>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>{heading}</h1>
          <p className="text-lead" style={{ margin: 0 }}>{c.lead}</p>
        </section>

        {/* Interactive Config Section */}
        <ClientConfigSection client={c} featuredServers={popular} />

        {/* Step-by-Step Instructions */}
        <section style={{ marginBottom: '3.5rem', maxWidth: '800px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={22} style={{ color: 'var(--accent-color)' }} />
            <span>Step-by-step Installation Guide</span>
          </h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {c.steps.map((s, i) => (
              <li
                key={s.title}
                className="surface"
                style={{
                  display: 'flex',
                  gap: '1.25rem',
                  alignItems: 'flex-start',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    background: 'var(--brand-gradient)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(0, 229, 255, 0.2)',
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>{s.title}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.925rem' }}>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Popular servers to try */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Popular MCP servers to try in {c.name}</h2>
            {hasDedicatedLandingPage && dedicatedLandingSlug && (
              <Link href={`/${dedicatedLandingSlug}`} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                View All Compatible Servers →
              </Link>
            )}
          </div>

          {popular.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {popular.map((server) => {
                const { displayName, org } = parseServerName(server.name);
                return (
                  <div
                    key={server.id}
                    className="surface"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '1.25rem',
                      borderRadius: '14px',
                      border: '1px solid var(--border-color)',
                      height: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={40} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link href={`/mcp/${server.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block' }}>{displayName}</span>
                        </Link>
                        {org && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{org}</span>}
                      </div>
                      {isVerifiedListing(server) && (
                        <span title="Verified" style={{ display: 'inline-flex' }}>
                          <BadgeCheck size={16} style={{ color: 'var(--accent-color)' }} />
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem', flexGrow: 1 }}>
                      <SafeMarkdown content={server.description || 'No description provided.'} isInline />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ display: 'flex', gap: '0.65rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Eye size={12} /> {(server.views || 0).toLocaleString()}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Download size={12} /> {(server.copies || 0).toLocaleString()}</span>
                      </div>
                      <ServerConfigCopyButton clientSlug={c.slug} serverName={server.name} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="surface empty-state" style={{ borderStyle: 'dashed' }}>
              <p className="empty-state-body" style={{ margin: 0 }}>No servers to show yet.</p>
            </div>
          )}
        </section>

        {/* FAQ Section */}
        <section style={{ marginBottom: '3.5rem', maxWidth: '800px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>Frequently Asked Questions</h2>
          <ClientFaqAccordion faqList={c.faq} />
        </section>

        {/* Other clients navigation */}
        <section style={{ maxWidth: '800px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Install MCP servers in other clients</h2>
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
