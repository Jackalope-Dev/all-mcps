import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronRight,
  Eye,
  Heart,
  Download,
  Star,
  Sparkles,
  ArrowRight,
  Check,
  Zap,
  Layers,
} from 'lucide-react';
import { Badge } from '../../../../components/ui/Badge';
import { ServerAvatar } from '../../../../components/ui/ServerAvatar';
import { SafeMarkdown } from '../../../../components/ui/SafeMarkdown';
import { FaqSection } from '../../../../components/ui/FaqSection';
import { getServerById, getRelatedServers, type Server } from '../../../../lib/servers';
import { isFeaturedListing, isVerifiedListing } from '../../../../lib/featuredStatus';
import { parseServerName } from '../../../../lib/displayName';
import { categorySlug, parseCategoryLabel, getCategoryMeta } from '../../../../lib/categories';
import { resolveInstallConfig } from '../../../../lib/installConfig';
import { AUTH_TYPE_LABELS, PRICING_MODEL_LABELS, type AuthType, type PricingModel } from '../../../../lib/serverEnums';

const SITE = 'https://allmcps.com';
const MAX = 12;

function truncateName(name: string, max: number): string {
  if (name.length <= max) return name;
  return `${name.slice(0, Math.max(6, max - 1)).trimEnd()}…`;
}

function buildAltTitle(displayName: string, categoryLabel: string): string {
  const name = truncateName(displayName, 25);
  const base = `Best Alternatives to ${name} (${categoryLabel})`;
  const withSuffix = `${base} | AllMCPs`;
  return withSuffix.length <= 60 ? withSuffix : base;
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
  const { label: categoryLabel } = parseCategoryLabel(server.category);
  const title = buildAltTitle(displayName, categoryLabel);

  const summaryText = (server.aiSummary && server.aiSummary.trim()) || server.description;
  const rawDescription = `Compare the best alternatives to ${displayName} MCP server (${categoryLabel}). ${summaryText.slice(0, 100)}. Evaluate feature matrices, install commands, and specs.`;
  const description =
    rawDescription.length > 157 ? `${rawDescription.slice(0, 154)}...` : rawDescription;
  const url = `${SITE}/mcp/${server.id}/alternatives`;

  return {
    title,
    description,
    keywords: [
      `alternatives to ${displayName}`,
      `${displayName} competitors`,
      `${displayName} MCP server alternative`,
      `${categoryLabel} MCP servers`,
      'Model Context Protocol',
      'AI tools',
    ].join(', '),
    alternates: { canonical: url },
    openGraph: { type: 'article', title, description, url },
    twitter: { card: 'summary_large_image', title, description },
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
      {typeof s.githubStars === 'number' && s.githubStars > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <Star size={13} style={{ color: '#f5c518' }} /> {(s.githubStars || 0).toLocaleString()}
        </span>
      )}
    </div>
  );
}

function getInstallLabel(s: Server): string {
  const cfg = resolveInstallConfig({
    id: s.id,
    name: s.name,
    url: s.url,
    description: s.description,
    installKind: s.installKind,
    installCommand: s.installCommand,
    installArgs: s.installArgs,
    installPackage: s.installPackage,
    installConfidence: s.installConfidence,
  });
  if (cfg.kind === 'remote') return 'Remote (SSE)';
  return cfg.command || 'npx';
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
  const catMeta = getCategoryMeta(server.category);
  const categoryLabel = catMeta.label;
  const catSlug = categorySlug(server.category);
  const alternatives = await getRelatedServers(server, MAX);
  const url = `${SITE}/mcp/${server.id}/alternatives`;

  // Top candidate names for FAQ & editorial content
  const topAltNames = alternatives.slice(0, 3).map((a) => parseServerName(a.name).displayName);
  const altNamesStr = topAltNames.length > 0 ? topAltNames.join(', ') : 'other featured MCP tools';

  // Grounded FAQ items
  const faqItems = [
    {
      q: `What is the best alternative to ${displayName}?`,
      a: topAltNames.length > 0
        ? `The top-rated alternatives to ${displayName} in the ${categoryLabel} category include ${altNamesStr}. These servers offer complementary or alternative capabilities depending on your deployment stack and authentication requirements.`
        : `Explore our ${categoryLabel} category index for the latest active Model Context Protocol tools compatible with Claude Desktop and Cursor.`,
    },
    {
      q: `How do ${displayName} alternatives differ in installation and runtime?`,
      a: `${displayName} and its alternatives vary by runtime requirement (Node.js/npx, Python/uvx, Docker, or remote HTTP/SSE endpoints). Check the specification comparison table above to verify command requirements before installing.`,
    },
    {
      q: `Are alternatives to ${displayName} free and open source?`,
      a: `Most MCP servers listed on AllMCPs are open source tools under MIT or Apache licenses that you can self-host or run locally with Claude Desktop, Cursor, VS Code, or Windsurf.`,
    },
    {
      q: `How do I side-by-side compare ${displayName} with a specific alternative?`,
      a: `Click the "Compare side-by-side →" button on any alternative card to see an in-depth comparison matrix covering feature lists, stars, npm downloads, install configurations, and schema specifications.`,
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `Alternatives to ${displayName}`,
        description: `Compare the best alternatives to ${displayName} MCP server in ${categoryLabel}. Evaluated by community engagement, specs, and features.`,
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
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Categories', item: `${SITE}/categories` },
          { '@type': 'ListItem', position: 3, name: categoryLabel, item: `${SITE}/categories/${catSlug}` },
          { '@type': 'ListItem', position: 4, name: displayName, item: `${SITE}/mcp/${server.id}` },
          { '@type': 'ListItem', position: 5, name: 'Alternatives', item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container page-shell" style={{ paddingTop: 'var(--space-8)', paddingBottom: '4rem' }}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
          <ol className="breadcrumb">
            <li><Link href="/">Home</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href="/categories">Categories</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href={`/categories/${catSlug}`}>{categoryLabel}</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href={`/mcp/${server.id}`}>{displayName}</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">Alternatives</li>
          </ol>
        </nav>

        {/* Hero Header */}
        <section style={{ marginBottom: '2.5rem', maxWidth: '820px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Badge variant="category" style={{ fontSize: '0.8rem' }}>
              <span aria-hidden="true">{catMeta.emoji}</span>
              <span>{categoryLabel}</span>
            </Badge>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>• MCP Alternatives Guide</span>
          </div>
          <h1 className="text-display" style={{ marginBottom: '1rem', fontSize: '2.25rem', lineHeight: 1.2 }}>
            Best Alternatives to {displayName}
          </h1>
          <p className="text-lead" style={{ margin: '0 0 1.5rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Looking for an alternative to <Link href={`/mcp/${server.id}`} style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{displayName}</Link>? 
            Whether you need a different runtime environment, custom authentication support, or alternative API integrations in the <strong>{categoryLabel}</strong> ecosystem, 
            we have cataloged and compared the top alternative MCP servers below.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href={`/categories/${catSlug}`} className="btn btn-secondary" style={{ fontSize: '0.875rem' }}>
              Browse all {categoryLabel} servers →
            </Link>
            <Link href={`/mcp/${server.id}`} className="btn btn-primary" style={{ fontSize: '0.875rem' }}>
              View {displayName} Specs →
            </Link>
          </div>
        </section>

        {/* Target Server AI Spotlight Card */}
        <section
          className="surface"
          style={{
            padding: '1.75rem',
            borderRadius: '16px',
            marginBottom: '3rem',
            border: '1px solid var(--accent-color)',
            background: 'var(--surface-highlight)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <ServerAvatar name={server.name} logoUrl={server.logoUrl} category={server.category} size={48} />
            <div>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-color)', fontWeight: 700 }}>
                Target Reference Server
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {displayName} Overview
              </h2>
            </div>
          </div>

          <p style={{ fontSize: '0.95rem', lineHeight: 1.65, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            {server.aiOverview || server.aiSummary || server.description}
          </p>

          {server.aiUseCases && server.aiUseCases.length > 0 && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={15} style={{ color: 'var(--accent-color)' }} /> Primary Use Cases for {displayName}:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {server.aiUseCases.slice(0, 4).map((useCase, idx) => (
                  <li key={idx}>{useCase}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Alternatives Matrix Table */}
        {alternatives.length > 0 && (
          <section style={{ marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} style={{ color: 'var(--accent-color)' }} /> Specification Matrix: {displayName} vs Alternatives
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Direct comparison of key metrics, runtimes, authentication methods, and community popularity.
            </p>

            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--surface-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Server Name</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Runtime</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Auth</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Pricing</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>GitHub Stars</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Downloads</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Reference Row */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0, 229, 255, 0.04)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={24} />
                        <span>{displayName} (Target)</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{getInstallLabel(server)}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      {server.authType ? (AUTH_TYPE_LABELS[server.authType as AuthType] || server.authType) : 'Free/None'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      {server.pricingModel ? (PRICING_MODEL_LABELS[server.pricingModel as PricingModel] || server.pricingModel) : 'Free'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{server.githubStars ? server.githubStars.toLocaleString() : '—'}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{server.copies ? server.copies.toLocaleString() : '—'}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-color)' }}>Current</span>
                    </td>
                  </tr>

                  {/* Alternative Rows */}
                  {alternatives.map((alt) => {
                    const altName = parseServerName(alt.name).displayName;
                    return (
                      <tr key={alt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>
                          <Link href={`/mcp/${alt.id}`} style={{ textDecoration: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ServerAvatar name={alt.name} logoUrl={alt.logoUrl} size={24} />
                            <span>{altName}</span>
                          </Link>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{getInstallLabel(alt)}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                          {alt.authType ? (AUTH_TYPE_LABELS[alt.authType as AuthType] || alt.authType) : 'Free/None'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                          {alt.pricingModel ? (PRICING_MODEL_LABELS[alt.pricingModel as PricingModel] || alt.pricingModel) : 'Free'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{alt.githubStars ? alt.githubStars.toLocaleString() : '—'}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{alt.copies ? alt.copies.toLocaleString() : '—'}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <Link
                            href={`/mcp/${server.id}/vs/${alt.id}`}
                            style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-color)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                          >
                            Compare →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Detailed Alternatives Cards */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Detailed Evaluation of {displayName} Alternatives
          </h2>

          {alternatives.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: '1.5rem' }}>
              {alternatives.map((alt) => {
                const altName = parseServerName(alt.name).displayName;
                const featured = isFeaturedListing(alt);
                const altSummary = alt.aiSummary || alt.aiOverview || alt.description;
                const featuresList = alt.aiFeatures && alt.aiFeatures.length > 0 ? alt.aiFeatures.slice(0, 3) : null;

                return (
                  <article
                    key={alt.id}
                    className="surface-interactive"
                    style={{
                      padding: '1.5rem',
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      border: featured ? '1px solid rgba(var(--accent-rgb), 0.4)' : '1px solid var(--border-color)',
                      background: featured
                        ? 'linear-gradient(135deg, rgba(var(--accent-rgb),0.06), rgba(var(--accent-secondary-rgb),0.04))'
                        : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <ServerAvatar name={alt.name} logoUrl={alt.logoUrl} size={40} />
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Link href={`/mcp/${alt.id}`} style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
                              {altName}
                            </Link>
                          </h3>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Runtime: {getInstallLabel(alt)}
                          </span>
                        </div>
                      </div>
                      {featured ? (
                        <Badge variant="success" className="badge-featured" style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                          ★ Featured
                        </Badge>
                      ) : isVerifiedListing(alt) ? (
                        <Badge variant="official" style={{ fontSize: '0.65rem', flexShrink: 0 }}>Verified</Badge>
                      ) : null}
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      <SafeMarkdown content={altSummary || 'No description provided.'} isInline />
                    </p>

                    {featuresList && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Key Features:</span>
                        {featuresList.map((f, i) => (
                          <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Check size={12} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <StatRow s={alt} />
                      <Link
                        href={`/mcp/${server.id}/vs/${alt.id}`}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: 'var(--accent-color)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        Compare side-by-side <ArrowRight size={14} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="surface" style={{ padding: '2rem', textAlign: 'center', borderRadius: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                We don&rsquo;t have close alternatives to <Link href={`/mcp/${server.id}`}>{displayName}</Link> catalogued yet. 
                Explore more {categoryLabel} servers in our directory.
              </p>
            </div>
          )}
        </section>

        {/* Grounded FAQ Section */}
        <section style={{ marginTop: '3rem' }}>
          <FaqSection
            items={faqItems}
            title={`Frequently Asked Questions: ${displayName} Alternatives`}
          />
        </section>
      </main>
    </>
  );
}
