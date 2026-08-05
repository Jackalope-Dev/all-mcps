import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Eye, Heart, Download, Star, BadgeCheck, Wrench } from 'lucide-react';
import { Badge } from '../../../../../components/ui/Badge';
import { ServerAvatar } from '../../../../../components/ui/ServerAvatar';
import { SafeMarkdown } from '../../../../../components/ui/SafeMarkdown';
import { getServerById, getRelatedServers, type Server } from '../../../../../lib/servers';
import { isFeaturedListing, isVerifiedListing } from '../../../../../lib/featuredStatus';
import { parseServerName } from '../../../../../lib/displayName';
import { categorySlug, parseCategoryLabel } from '../../../../../lib/categories';
import { computeQualityScore } from '../../../../../lib/qualityScore';
import { resolveInstallConfig } from '../../../../../lib/installConfig';

const SITE = 'https://allmcps.com';

/** Stable canonical for a pair so A/vs/B and B/vs/A consolidate in search. */
function canonicalPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

function installSummary(s: Server): string {
  const install = resolveInstallConfig({
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
  if (install.kind === 'remote') {
    return `Remote · ${install.confidence}`;
  }
  return `${install.command} · ${install.confidence}`;
}

function toolNames(s: Server, max = 6): string[] {
  if (s.tools?.length) {
    return s.tools
      .map((t) => t.name)
      .filter(Boolean)
      .slice(0, max);
  }
  if (s.aiFeatures?.length) {
    return s.aiFeatures.slice(0, max);
  }
  return [];
}

/** Keeps a display name short enough that the compare title stays inside the SEO budget. */
function truncateName(name: string, max: number): string {
  if (name.length <= max) return name;
  return `${name.slice(0, Math.max(6, max - 1)).trimEnd()}…`;
}

/** Builds "A vs B — MCP Server Comparison", dropping the suffix if the pair of names is long. */
function buildCompareTitle(nameA: string, nameB: string): string {
  const a = truncateName(nameA, 22);
  const b = truncateName(nameB, 22);
  const base = `${a} vs ${b}`;
  const withSuffix = `${base} — MCP Server Comparison`;
  return withSuffix.length <= 50 ? withSuffix : base;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; other: string }>;
}): Promise<Metadata> {
  const { id, other } = await params;
  if (id === other) return { title: 'Not Found', robots: { index: false } };

  const [a, b] = await Promise.all([getServerById(id), getServerById(other)]);
  if (!a || !b || a.status !== 'active' || b.status !== 'active') {
    return { title: 'Not Found', robots: { index: false } };
  }

  const nameA = parseServerName(a.name).displayName;
  const nameB = parseServerName(b.name).displayName;
  const [c0, c1] = canonicalPair(id, other);
  const shortA = truncateName(nameA, 22);
  const shortB = truncateName(nameB, 22);
  const title = buildCompareTitle(nameA, nameB);
  const description = `Compare ${shortA} and ${shortB} MCP servers: install paths, tools, usage, quality signals, and which fits your AI agent stack.`;
  const url = `${SITE}/mcp/${c0}/vs/${c1}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: `${title} | AllMCPs`, description, url },
    twitter: { card: 'summary_large_image', title: `${title} | AllMCPs`, description },
  };
}

function Row({
  label,
  left,
  right,
  hint,
}: {
  label: string;
  left: ReactNode;
  right: ReactNode;
  hint?: string;
}) {
  return (
    <tr>
      <th
        scope="row"
        style={{
          textAlign: 'left',
          padding: '0.85rem 1rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          borderBottom: '1px solid var(--border-color)',
          width: '22%',
          verticalAlign: 'top',
        }}
        title={hint}
      >
        {label}
      </th>
      <td
        style={{
          padding: '0.85rem 1rem',
          fontSize: '0.9rem',
          borderBottom: '1px solid var(--border-color)',
          verticalAlign: 'top',
          width: '39%',
        }}
      >
        {left}
      </td>
      <td
        style={{
          padding: '0.85rem 1rem',
          fontSize: '0.9rem',
          borderBottom: '1px solid var(--border-color)',
          verticalAlign: 'top',
          width: '39%',
        }}
      >
        {right}
      </td>
    </tr>
  );
}

function SideHeader({ s }: { s: Server }) {
  const { displayName, org } = parseServerName(s.name);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'flex-start' }}>
      <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={40} />
      <div>
        <Link
          href={`/mcp/${s.id}`}
          style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', textDecoration: 'none' }}
        >
          {displayName}
        </Link>
        {org && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{org}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {isFeaturedListing(s) && (
          <Badge variant="success" style={{ fontSize: '0.65rem', color: '#00E5FF', borderColor: 'rgba(0,229,255,0.35)' }}>
            Featured
          </Badge>
        )}
        {isVerifiedListing(s) && (
          <Badge variant="official" style={{ fontSize: '0.65rem' }}>
            Verified
          </Badge>
        )}
        <Badge variant="category" style={{ fontSize: '0.65rem' }}>
          {s.category}
        </Badge>
      </div>
    </div>
  );
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string; other: string }>;
}) {
  const { id, other } = await params;
  if (!id || !other || id === other) notFound();

  const [left, right] = await Promise.all([getServerById(id), getServerById(other)]);
  if (!left || !right) notFound();
  if (left.status !== 'active' || right.status !== 'active') notFound();

  const nameL = parseServerName(left.name).displayName;
  const nameR = parseServerName(right.name).displayName;
  const [c0, c1] = canonicalPair(id, other);
  const canonicalUrl = `${SITE}/mcp/${c0}/vs/${c1}`;
  const pageUrl = `${SITE}/mcp/${id}/vs/${other}`;

  const qL = computeQualityScore(left);
  const qR = computeQualityScore(right);
  const toolsL = toolNames(left);
  const toolsR = toolNames(right);

  const moreAlts = (await getRelatedServers(left, 6)).filter((s) => s.id !== right.id).slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: `${nameL} vs ${nameR}`,
        description: `Side-by-side comparison of the ${nameL} and ${nameR} Model Context Protocol servers.`,
        url: canonicalUrl,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Browse', item: `${SITE}/browse` },
          { '@type': 'ListItem', position: 3, name: nameL, item: `${SITE}/mcp/${left.id}` },
          { '@type': 'ListItem', position: 4, name: `vs ${nameR}`, item: pageUrl },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `What is the difference between ${nameL} and ${nameR}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${nameL} and ${nameR} are both MCP servers listed on AllMCPs. Compare category (${parseCategoryLabel(left.category).label} vs ${parseCategoryLabel(right.category).label}), install path, tools, and usage signals on this page to pick the better fit for your agent stack.`,
            },
          },
          {
            '@type': 'Question',
            name: `How do I install ${nameL} or ${nameR}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Open each listing for client-specific install buttons and config. Install signal: ${nameL} uses ${installSummary(left)}; ${nameR} uses ${installSummary(right)}. Always verify against the project README before production use.`,
            },
          },
          {
            '@type': 'Question',
            name: `Which MCP server is more popular, ${nameL} or ${nameR}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `On AllMCPs, ${nameL} has ${(left.views || 0).toLocaleString()} views and ${(left.upvotes || 0).toLocaleString()} upvotes; ${nameR} has ${(right.views || 0).toLocaleString()} views and ${(right.upvotes || 0).toLocaleString()} upvotes. Popularity is one signal — match tools and install fit to your use case.`,
            },
          },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container page-shell" style={{ paddingBottom: '4rem' }}>
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '2rem' }}>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li>
              <Link href="/browse">Browse</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li>
              <Link href={`/mcp/${left.id}`}>{nameL}</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">
              vs {nameR}
            </li>
          </ol>
        </nav>

        <section style={{ marginBottom: '2rem', maxWidth: 820 }}>
          <h1 className="text-display" style={{ marginBottom: '0.75rem' }}>
            {nameL} vs {nameR}
          </h1>
          <p className="text-lead" style={{ margin: 0 }}>
            Side-by-side comparison of two Model Context Protocol servers — install paths, tools, quality
            signals, and directory engagement so you can pick the right one for Claude, Cursor, and other
            MCP clients.
          </p>
        </section>

        <div className="surface" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th
                    style={{
                      padding: '1.1rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      borderBottom: '1px solid var(--border-color)',
                      width: '22%',
                    }}
                  >
                    Compare
                  </th>
                  <th
                    style={{
                      padding: '1.1rem 1rem',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-color)',
                      width: '39%',
                    }}
                  >
                    <SideHeader s={left} />
                  </th>
                  <th
                    style={{
                      padding: '1.1rem 1rem',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-color)',
                      width: '39%',
                    }}
                  >
                    <SideHeader s={right} />
                  </th>
                </tr>
              </thead>
              <tbody>
                <Row
                  label="Summary"
                  left={
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, display: 'block' }}>
                      <SafeMarkdown content={left.description || '—'} isInline />
                    </span>
                  }
                  right={
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, display: 'block' }}>
                      <SafeMarkdown content={right.description || '—'} isInline />
                    </span>
                  }
                />
                <Row
                  label="Quality signal"
                  hint="Editorial completeness/health signal, not a user star rating"
                  left={
                    <span style={{ fontWeight: 700 }}>
                      {qL.score}/100 <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>({qL.tier})</span>
                    </span>
                  }
                  right={
                    <span style={{ fontWeight: 700 }}>
                      {qR.score}/100 <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>({qR.tier})</span>
                    </span>
                  }
                />
                <Row
                  label="Install path"
                  left={<code style={{ fontSize: '0.8rem' }}>{installSummary(left)}</code>}
                  right={<code style={{ fontSize: '0.8rem' }}>{installSummary(right)}</code>}
                />
                <Row
                  label="Engagement"
                  left={
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Eye size={13} /> {(left.views || 0).toLocaleString()}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Download size={13} /> {(left.copies || 0).toLocaleString()}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Heart size={13} /> {(left.upvotes || 0).toLocaleString()}
                      </span>
                      {typeof left.githubStars === 'number' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Star size={13} /> {left.githubStars.toLocaleString()}
                        </span>
                      )}
                    </span>
                  }
                  right={
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Eye size={13} /> {(right.views || 0).toLocaleString()}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Download size={13} /> {(right.copies || 0).toLocaleString()}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Heart size={13} /> {(right.upvotes || 0).toLocaleString()}
                      </span>
                      {typeof right.githubStars === 'number' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Star size={13} /> {right.githubStars.toLocaleString()}
                        </span>
                      )}
                    </span>
                  }
                />
                <Row
                  label="Tools"
                  left={
                    toolsL.length ? (
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {toolsL.map((t) => (
                          <Badge key={t} variant="default" style={{ fontSize: '0.7rem' }}>
                            <Wrench size={10} style={{ marginRight: 3 }} />
                            {t}
                          </Badge>
                        ))}
                        {(left.tools?.length || 0) > toolsL.length && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            +{(left.tools?.length || 0) - toolsL.length} more
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Not listed yet</span>
                    )
                  }
                  right={
                    toolsR.length ? (
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {toolsR.map((t) => (
                          <Badge key={t} variant="default" style={{ fontSize: '0.7rem' }}>
                            <Wrench size={10} style={{ marginRight: 3 }} />
                            {t}
                          </Badge>
                        ))}
                        {(right.tools?.length || 0) > toolsR.length && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            +{(right.tools?.length || 0) - toolsR.length} more
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Not listed yet</span>
                    )
                  }
                />
                <Row
                  label="Verified / official"
                  left={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                      {isVerifiedListing(left) ? (
                        <>
                          <BadgeCheck size={16} color="#34d399" /> Yes
                        </>
                      ) : (
                        'No'
                      )}
                    </span>
                  }
                  right={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                      {isVerifiedListing(right) ? (
                        <>
                          <BadgeCheck size={16} color="#34d399" /> Yes
                        </>
                      ) : (
                        'No'
                      )}
                    </span>
                  }
                />
                <Row
                  label="Open listing"
                  left={
                    <Link href={`/mcp/${left.id}`} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}>
                      View {nameL}
                    </Link>
                  }
                  right={
                    <Link href={`/mcp/${right.id}`} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}>
                      View {nameR}
                    </Link>
                  }
                />
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <Link href={`/mcp/${left.id}/alternatives`} className="btn btn-secondary">
            More alternatives to {nameL}
          </Link>
          <Link href={`/mcp/${right.id}/alternatives`} className="btn btn-secondary">
            More alternatives to {nameR}
          </Link>
          <Link href={`/categories/${categorySlug(left.category)}`} className="btn btn-secondary">
            {parseCategoryLabel(left.category).label} category
          </Link>
          {id !== c0 && (
            <Link href={`/mcp/${c0}/vs/${c1}`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
              Canonical compare URL
            </Link>
          )}
        </div>

        {moreAlts.length > 0 && (
          <section>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Other servers like {nameL}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {moreAlts.map((alt) => {
                const n = parseServerName(alt.name).displayName;
                return (
                  <li key={alt.id}>
                    <Link
                      href={`/mcp/${left.id}/vs/${alt.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 10,
                        border: '1px solid var(--border-color)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <ServerAvatar name={alt.name} logoUrl={alt.logoUrl} size={28} />
                      <span style={{ fontWeight: 600, flex: 1 }}>{nameL} vs {n}</span>
                      <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
