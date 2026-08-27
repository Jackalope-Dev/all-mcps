import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Code2,
  DollarSign,
  Download,
  Eye,
  Heart,
  HelpCircle,
  Layers,
  Lock,
  Sparkles,
  Star,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge } from '../../../../../components/ui/Badge';
import { CopyBlock } from '../../../../../components/ui/CopyBlock';
import { FaqSection } from '../../../../../components/ui/FaqSection';
import { SafeMarkdown } from '../../../../../components/ui/SafeMarkdown';
import { ServerAvatar } from '../../../../../components/ui/ServerAvatar';
import {
  categorySlug,
  parseCategoryLabel,
} from '../../../../../lib/categories';
import { parseServerName } from '../../../../../lib/displayName';
import {
  isFeaturedListing,
  isVerifiedListing,
} from '../../../../../lib/featuredStatus';
import { resolveInstallConfig } from '../../../../../lib/installConfig';
import { computeQualityScore } from '../../../../../lib/qualityScore';
import {
  getRelatedServers,
  getServerById,
  type Server,
} from '../../../../../lib/servers';

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
    return `Remote (HTTP/SSE) · ${install.confidence}`;
  }
  return `${install.command} · ${install.confidence}`;
}

function buildConfigSnippet(s: Server): string {
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

  const key = s.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (install.kind === 'remote') {
    return JSON.stringify(
      {
        mcpServers: {
          [key]: {
            url: install.url,
          },
        },
      },
      null,
      2,
    );
  }

  const envObj: Record<string, string> = {};
  if (s.aiEnvVars && s.aiEnvVars.length > 0) {
    s.aiEnvVars.forEach((v: string) => {
      envObj[v] = `YOUR_${v}_HERE`;
    });
  }

  return JSON.stringify(
    {
      mcpServers: {
        [key]: {
          command: install.command,
          args: install.args,
          ...(Object.keys(envObj).length > 0 ? { env: envObj } : {}),
        },
      },
    },
    null,
    2,
  );
}

function toolNames(s: Server, max = 12): string[] {
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

function formatAuthLabel(auth?: string | null): string {
  if (!auth || auth === 'none') return 'No auth required';
  if (auth === 'api_key') return 'API Key required';
  if (auth === 'oauth') return 'OAuth 2.0';
  if (auth === 'byok') return 'Bring Your Own Key';
  return auth;
}

function formatPricingLabel(pricing?: string | null): string {
  if (!pricing || pricing === 'free') return 'Free / Open Source';
  if (pricing === 'freemium') return 'Freemium';
  if (pricing === 'paid') return 'Paid Service';
  if (pricing === 'byok') return 'BYOK (Pay Provider Direct)';
  return pricing;
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
  return withSuffix.length <= 55 ? withSuffix : base;
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
  const description = `Compare ${shortA} vs ${shortB} MCP servers side-by-side: tools, transport specs, install commands, auth requirements, and Claude/Cursor config snippets.`;
  const url = `${SITE}/mcp/${c0}/vs/${c1}`;

  return {
    title,
    description,
    robots: { index: false, follow: true },
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
          padding: '0.95rem 1rem',
          fontSize: '0.825rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          borderBottom: '1px solid var(--border-color)',
          width: '24%',
          verticalAlign: 'top',
        }}
        title={hint}
      >
        {label}
      </th>
      <td
        style={{
          padding: '0.95rem 1rem',
          fontSize: '0.9rem',
          borderBottom: '1px solid var(--border-color)',
          verticalAlign: 'top',
          width: '38%',
        }}
      >
        {left}
      </td>
      <td
        style={{
          padding: '0.95rem 1rem',
          fontSize: '0.9rem',
          borderBottom: '1px solid var(--border-color)',
          verticalAlign: 'top',
          width: '38%',
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        alignItems: 'flex-start',
      }}
    >
      <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={42} />
      <div>
        <Link
          href={`/mcp/${s.id}`}
          style={{
            fontWeight: 800,
            fontSize: '1.15rem',
            color: 'var(--text-primary)',
            textDecoration: 'none',
          }}
        >
          {displayName}
        </Link>
        {org && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginTop: 2,
            }}
          >
            {org}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {isFeaturedListing(s) && (
          <Badge
            variant="success"
            style={{
              fontSize: '0.65rem',
              color: 'var(--accent-color)',
              borderColor: 'rgba(var(--accent-rgb),0.35)',
            }}
          >
            Featured
          </Badge>
        )}
        {isVerifiedListing(s) && (
          <Badge variant="official" style={{ fontSize: '0.65rem' }}>
            Verified
          </Badge>
        )}
        <Badge variant="category" style={{ fontSize: '0.65rem' }}>
          {parseCategoryLabel(s.category).label}
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

  const [left, right] = await Promise.all([
    getServerById(id),
    getServerById(other),
  ]);
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
  const installL = resolveInstallConfig(left);
  const installR = resolveInstallConfig(right);

  const snippetL = buildConfigSnippet(left);
  const snippetR = buildConfigSnippet(right);

  const catL = parseCategoryLabel(left.category).label;
  const catR = parseCategoryLabel(right.category).label;

  const [moreAltsLeft, moreAltsRight] = await Promise.all([
    getRelatedServers(left, 8).then((list) =>
      list.filter((s) => s.id !== right.id).slice(0, 4),
    ),
    getRelatedServers(right, 8).then((list) =>
      list.filter((s) => s.id !== left.id).slice(0, 4),
    ),
  ]);

  // Structured Data (Schema.org) for Search Engines & AI Search Crawlers
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: `${nameL} vs ${nameR} — MCP Server Comparison`,
        description: `Detailed comparison between ${nameL} and ${nameR} Model Context Protocol (MCP) servers: tools, install specs, auth models, and client configs.`,
        url: canonicalUrl,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Browse',
            item: `${SITE}/browse`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: nameL,
            item: `${SITE}/mcp/${left.id}`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: `vs ${nameR}`,
            item: pageUrl,
          },
        ],
      },
      {
        '@type': 'SoftwareApplication',
        name: nameL,
        applicationCategory: catL,
        operatingSystem: 'Cross-platform',
        url: `${SITE}/mcp/${left.id}`,
      },
      {
        '@type': 'SoftwareApplication',
        name: nameR,
        applicationCategory: catR,
        operatingSystem: 'Cross-platform',
        url: `${SITE}/mcp/${right.id}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `What is the key difference between ${nameL} and ${nameR}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${nameL} belongs to the ${catL} category with ${installL.kind === 'remote' ? 'cloud HTTP/SSE' : 'local stdio'} execution, while ${nameR} belongs to the ${catR} category with ${installR.kind === 'remote' ? 'cloud HTTP/SSE' : 'local stdio'} execution.`,
            },
          },
          {
            '@type': 'Question',
            name: `How do I install ${nameL} or ${nameR} in Claude Desktop or Cursor?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Copy the mcpServers JSON configuration snippet provided on this page into your claude_desktop_config.json or ~/.cursor/mcp.json file and restart your AI client.`,
            },
          },
          {
            '@type': 'Question',
            name: `Are ${nameL} and ${nameR} free or paid?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${nameL} operates under a ${formatPricingLabel(left.pricingModel)} model (${formatAuthLabel(left.authType)}). ${nameR} operates under a ${formatPricingLabel(right.pricingModel)} model (${formatAuthLabel(right.authType)}).`,
            },
          },
          {
            '@type': 'Question',
            name: `Which MCP server has more tools and community activity?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${nameL} lists ${left.tools?.length || toolsL.length} tools with ${(left.views || 0).toLocaleString()} views and ${(left.githubStars || 0).toLocaleString()} GitHub stars. ${nameR} lists ${right.tools?.length || toolsR.length} tools with ${(right.views || 0).toLocaleString()} views and ${(right.githubStars || 0).toLocaleString()} GitHub stars.`,
            },
          },
          {
            '@type': 'Question',
            name: `Can I use both ${nameL} and ${nameR} together in the same MCP host?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Yes! MCP hosts like Claude Desktop, Cursor, Windsurf, Cline, and VS Code support configuring multiple servers under the mcpServers object simultaneously.`,
            },
          },
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
      <main className="container page-shell" style={{ paddingBottom: '5rem' }}>
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '1.75rem' }}>
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
            <li className="breadcrumb-current">vs {nameR}</li>
          </ol>
        </nav>

        {/* Page Header */}
        <section style={{ marginBottom: '2rem', maxWidth: 860 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: '0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--brand-cyan)',
            }}
          >
            <Sparkles size={14} /> Side-by-Side Model Context Protocol
            Comparison
          </div>
          <h1 className="text-display" style={{ marginBottom: '0.85rem' }}>
            {nameL} vs {nameR}
          </h1>
          <p className="text-lead" style={{ margin: 0, lineHeight: 1.6 }}>
            In-depth architectural comparison of the <strong>{nameL}</strong>{' '}
            and <strong>{nameR}</strong> MCP servers. Compare execution
            transports, security boundaries, tool capabilities, quality scores,
            and ready-to-paste client installation snippets for Claude, Cursor,
            Windsurf, and VS Code.
          </p>
        </section>

        {/* Executive Summary & Verdict Card */}
        <section
          className="surface"
          style={{
            border: '1px solid rgba(var(--accent-rgb, 0, 229, 255), 0.3)',
            borderRadius: 14,
            padding: '1.5rem',
            marginBottom: '2.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: '1rem',
            }}
          >
            <Zap size={18} color="var(--brand-cyan)" />
            <h2
              style={{
                fontSize: '1.1rem',
                margin: 0,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              At a Glance & Executive Verdict
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.25rem',
            }}
          >
            <div
              style={{
                background: 'var(--bg-muted)',
                padding: '1rem',
                borderRadius: 10,
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--brand-cyan)',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {nameL}
              </div>
              <div
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {catL} ·{' '}
                {installL.kind === 'remote' ? 'Remote HTTP/SSE' : 'Local stdio'}
              </div>
              <div
                style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
              >
                Quality:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {qL.score}/100
                </strong>{' '}
                ({qL.tier}) | Auth:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatAuthLabel(left.authType)}
                </strong>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-muted)',
                padding: '1rem',
                borderRadius: 10,
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--brand-cyan)',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {nameR}
              </div>
              <div
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {catR} ·{' '}
                {installR.kind === 'remote' ? 'Remote HTTP/SSE' : 'Local stdio'}
              </div>
              <div
                style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
              >
                Quality:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {qR.score}/100
                </strong>{' '}
                ({qR.tier}) | Auth:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatAuthLabel(right.authType)}
                </strong>
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1rem',
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>
              Verdict Summary:
            </strong>{' '}
            Choose{' '}
            <strong style={{ color: 'var(--brand-cyan)' }}>{nameL}</strong> if
            you need specialized {catL} tools running via{' '}
            {installL.kind === 'remote'
              ? 'a hosted cloud SSE transport'
              : 'a local process'}
            . Choose{' '}
            <strong style={{ color: 'var(--brand-cyan)' }}>{nameR}</strong> if
            your workspace requires {catR} integration with{' '}
            {installR.kind === 'remote'
              ? 'remote web transport'
              : 'local subprocess execution'}
            . Both servers can be configured concurrently in your client's{' '}
            <code style={{ color: 'var(--brand-cyan)' }}>mcpServers</code>{' '}
            manifest.
          </div>
        </section>

        {/* "Which Should You Choose?" Decision Matrix */}
        <section style={{ marginBottom: '3rem' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-primary)',
            }}
          >
            <HelpCircle size={20} color="var(--brand-cyan)" /> Which MCP Server
            Should You Choose?
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Card Left */}
            <div
              className="surface"
              style={{
                padding: '1.5rem',
                borderRadius: 12,
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
              }}
            >
              <div
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: '1rem',
                  }}
                >
                  <ServerAvatar
                    name={left.name}
                    logoUrl={left.logoUrl}
                    size={32}
                  />
                  <h3
                    style={{
                      fontSize: '1.15rem',
                      margin: 0,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Choose {nameL} when:
                  </h3>
                </div>
                <ul
                  style={{
                    paddingLeft: '1.2rem',
                    margin: 0,
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    lineHeight: 1.5,
                  }}
                >
                  <li>
                    You need dedicated capabilities in the{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {catL}
                    </strong>{' '}
                    domain.
                  </li>
                  <li>
                    You prefer{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {installL.kind === 'remote'
                        ? 'remote streaming HTTP/SSE'
                        : 'local stdio subprocess'}
                    </strong>{' '}
                    transport architecture.
                  </li>
                  <li>
                    Your security boundary fits:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {formatAuthLabel(left.authType)}
                    </strong>{' '}
                    ({formatPricingLabel(left.pricingModel)}).
                  </li>
                  {left.aiEnvVars && left.aiEnvVars.length > 0 && (
                    <li>
                      You have access to required keys:{' '}
                      <code style={{ fontSize: '0.75rem' }}>
                        {left.aiEnvVars.join(', ')}
                      </code>
                      .
                    </li>
                  )}
                  {toolsL.length > 0 && (
                    <li>
                      Primary tools included:{' '}
                      <span
                        style={{ color: 'var(--brand-cyan)', fontWeight: 600 }}
                      >
                        {toolsL.slice(0, 3).join(', ')}
                      </span>
                      .
                    </li>
                  )}
                </ul>
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <Link
                  href={`/mcp/${left.id}`}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                  }}
                >
                  Explore {nameL} Details <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Card Right */}
            <div
              className="surface"
              style={{
                padding: '1.5rem',
                borderRadius: 12,
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
              }}
            >
              <div
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: '1rem',
                  }}
                >
                  <ServerAvatar
                    name={right.name}
                    logoUrl={right.logoUrl}
                    size={32}
                  />
                  <h3
                    style={{
                      fontSize: '1.15rem',
                      margin: 0,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Choose {nameR} when:
                  </h3>
                </div>
                <ul
                  style={{
                    paddingLeft: '1.2rem',
                    margin: 0,
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    lineHeight: 1.5,
                  }}
                >
                  <li>
                    You need dedicated capabilities in the{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {catR}
                    </strong>{' '}
                    domain.
                  </li>
                  <li>
                    You prefer{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {installR.kind === 'remote'
                        ? 'remote streaming HTTP/SSE'
                        : 'local stdio subprocess'}
                    </strong>{' '}
                    transport architecture.
                  </li>
                  <li>
                    Your security boundary fits:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {formatAuthLabel(right.authType)}
                    </strong>{' '}
                    ({formatPricingLabel(right.pricingModel)}).
                  </li>
                  {right.aiEnvVars && right.aiEnvVars.length > 0 && (
                    <li>
                      You have access to required keys:{' '}
                      <code style={{ fontSize: '0.75rem' }}>
                        {right.aiEnvVars.join(', ')}
                      </code>
                      .
                    </li>
                  )}
                  {toolsR.length > 0 && (
                    <li>
                      Primary tools included:{' '}
                      <span
                        style={{ color: 'var(--brand-cyan)', fontWeight: 600 }}
                      >
                        {toolsR.slice(0, 3).join(', ')}
                      </span>
                      .
                    </li>
                  )}
                </ul>
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <Link
                  href={`/mcp/${right.id}`}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                  }}
                >
                  Explore {nameR} Details <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature & Specification Comparison Table */}
        <section style={{ marginBottom: '3rem' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              marginBottom: '1rem',
              color: 'var(--text-primary)',
            }}
          >
            Feature & Specification Comparison
          </h2>
          <div
            className="surface"
            style={{ padding: 0, overflow: 'hidden', borderRadius: 12 }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 680,
                }}
              >
                <thead>
                  <tr style={{ background: 'var(--bg-muted)' }}>
                    <th
                      style={{
                        padding: '1.1rem 1rem',
                        textAlign: 'left',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        borderBottom: '1px solid var(--border-color)',
                        width: '24%',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Specification
                    </th>
                    <th
                      style={{
                        padding: '1.1rem 1rem',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--border-color)',
                        width: '38%',
                      }}
                    >
                      <SideHeader s={left} />
                    </th>
                    <th
                      style={{
                        padding: '1.1rem 1rem',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--border-color)',
                        width: '38%',
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
                      <span
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.85rem',
                          lineHeight: 1.5,
                          display: 'block',
                        }}
                      >
                        <SafeMarkdown
                          content={left.description || '—'}
                          isInline
                        />
                      </span>
                    }
                    right={
                      <span
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.85rem',
                          lineHeight: 1.5,
                          display: 'block',
                        }}
                      >
                        <SafeMarkdown
                          content={right.description || '—'}
                          isInline
                        />
                      </span>
                    }
                  />
                  <Row
                    label="Category & Scope"
                    left={
                      <Link
                        href={`/categories/${categorySlug(left.category)}`}
                        style={{
                          color: 'var(--brand-cyan)',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        {catL}
                      </Link>
                    }
                    right={
                      <Link
                        href={`/categories/${categorySlug(right.category)}`}
                        style={{
                          color: 'var(--brand-cyan)',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        {catR}
                      </Link>
                    }
                  />
                  <Row
                    label="Quality signal"
                    hint="Editorial completeness/health signal calculated by AllMCPs directory"
                    left={
                      <span
                        style={{
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {qL.score}/100{' '}
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                          }}
                        >
                          ({qL.tier})
                        </span>
                      </span>
                    }
                    right={
                      <span
                        style={{
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {qR.score}/100{' '}
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                          }}
                        >
                          ({qR.tier})
                        </span>
                      </span>
                    }
                  />
                  <Row
                    label="Transport Protocol"
                    hint="Model Context Protocol transport layer mechanism"
                    left={
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Terminal size={14} color="var(--brand-cyan)" />
                        {installL.kind === 'remote'
                          ? 'Remote HTTP/SSE'
                          : 'Local Subprocess (stdio)'}
                      </span>
                    }
                    right={
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Terminal size={14} color="var(--brand-cyan)" />
                        {installR.kind === 'remote'
                          ? 'Remote HTTP/SSE'
                          : 'Local Subprocess (stdio)'}
                      </span>
                    }
                  />
                  <Row
                    label="Auth Requirement"
                    left={
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Lock size={13} color="var(--text-secondary)" />
                        {formatAuthLabel(left.authType)}
                      </span>
                    }
                    right={
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Lock size={13} color="var(--text-secondary)" />
                        {formatAuthLabel(right.authType)}
                      </span>
                    }
                  />
                  <Row
                    label="Pricing Model"
                    left={
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <DollarSign size={13} color="#34d399" />
                        {formatPricingLabel(left.pricingModel)}
                      </span>
                    }
                    right={
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <DollarSign size={13} color="#34d399" />
                        {formatPricingLabel(right.pricingModel)}
                      </span>
                    }
                  />
                  <Row
                    label="Required Env Vars"
                    left={
                      left.aiEnvVars && left.aiEnvVars.length > 0 ? (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                          }}
                        >
                          {left.aiEnvVars.map((v: string) => (
                            <code
                              key={v}
                              style={{
                                fontSize: '0.725rem',
                                padding: '0.2rem 0.4rem',
                                borderRadius: 4,
                                background: 'var(--bg-muted)',
                              }}
                            >
                              {v}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                          }}
                        >
                          None required
                        </span>
                      )
                    }
                    right={
                      right.aiEnvVars && right.aiEnvVars.length > 0 ? (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                          }}
                        >
                          {right.aiEnvVars.map((v: string) => (
                            <code
                              key={v}
                              style={{
                                fontSize: '0.725rem',
                                padding: '0.2rem 0.4rem',
                                borderRadius: 4,
                                background: 'var(--bg-muted)',
                              }}
                            >
                              {v}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                          }}
                        >
                          None required
                        </span>
                      )
                    }
                  />
                  <Row
                    label="Compatible Clients"
                    left={
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                        }}
                      >
                        {[
                          'Claude Desktop',
                          'Cursor',
                          'Windsurf',
                          'Cline',
                          'VS Code',
                        ].map((c) => (
                          <Badge
                            key={c}
                            variant="default"
                            style={{ fontSize: '0.68rem' }}
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    }
                    right={
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                        }}
                      >
                        {[
                          'Claude Desktop',
                          'Cursor',
                          'Windsurf',
                          'Cline',
                          'VS Code',
                        ].map((c) => (
                          <Badge
                            key={c}
                            variant="default"
                            style={{ fontSize: '0.68rem' }}
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    }
                  />
                  <Row
                    label="Install path signal"
                    left={
                      <code style={{ fontSize: '0.8rem' }}>
                        {installSummary(left)}
                      </code>
                    }
                    right={
                      <code style={{ fontSize: '0.8rem' }}>
                        {installSummary(right)}
                      </code>
                    }
                  />
                  <Row
                    label="Engagement & Health"
                    left={
                      <span
                        style={{
                          display: 'inline-flex',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Eye size={13} /> {(left.views || 0).toLocaleString()}{' '}
                          views
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Download size={13} />{' '}
                          {(left.copies || 0).toLocaleString()} copies
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Heart size={13} />{' '}
                          {(left.upvotes || 0).toLocaleString()} upvotes
                        </span>
                        {typeof left.githubStars === 'number' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Star size={13} />{' '}
                            {left.githubStars.toLocaleString()} stars
                          </span>
                        )}
                      </span>
                    }
                    right={
                      <span
                        style={{
                          display: 'inline-flex',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Eye size={13} />{' '}
                          {(right.views || 0).toLocaleString()} views
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Download size={13} />{' '}
                          {(right.copies || 0).toLocaleString()} copies
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Heart size={13} />{' '}
                          {(right.upvotes || 0).toLocaleString()} upvotes
                        </span>
                        {typeof right.githubStars === 'number' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Star size={13} />{' '}
                            {right.githubStars.toLocaleString()} stars
                          </span>
                        )}
                      </span>
                    }
                  />
                  <Row
                    label="Verified / Official"
                    left={
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.85rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {isVerifiedListing(left) ? (
                          <>
                            <BadgeCheck size={16} color="#34d399" /> Yes
                            (Verified)
                          </>
                        ) : (
                          'Community Listing'
                        )}
                      </span>
                    }
                    right={
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.85rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {isVerifiedListing(right) ? (
                          <>
                            <BadgeCheck size={16} color="#34d399" /> Yes
                            (Verified)
                          </>
                        ) : (
                          'Community Listing'
                        )}
                      </span>
                    }
                  />
                  <Row
                    label="Open full listing"
                    left={
                      <Link
                        href={`/mcp/${left.id}`}
                        className="btn btn-primary"
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.45rem 0.85rem',
                        }}
                      >
                        View {nameL} Listing
                      </Link>
                    }
                    right={
                      <Link
                        href={`/mcp/${right.id}`}
                        className="btn btn-primary"
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.45rem 0.85rem',
                        }}
                      >
                        View {nameR} Listing
                      </Link>
                    }
                  />
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Side-by-Side Tools & Capabilities Inspector */}
        <section style={{ marginBottom: '3rem' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-primary)',
            }}
          >
            <Wrench size={20} color="var(--brand-cyan)" /> Tools & Capabilities
            Breakdown
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <div
              className="surface"
              style={{ padding: '1.5rem', borderRadius: 12 }}
            >
              <h3
                style={{
                  fontSize: '1.1rem',
                  marginBottom: '0.75rem',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                }}
              >
                {nameL} Tools ({left.tools?.length || toolsL.length})
              </h3>
              {toolsL.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {toolsL.map((t: string) => {
                    const toolObj = left.tools?.find((item) => item.name === t);
                    return (
                      <div
                        key={t}
                        style={{
                          background: 'var(--bg-muted)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 8,
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: 'var(--brand-cyan)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Wrench size={12} /> {t}
                        </div>
                        {toolObj?.description && (
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-secondary)',
                              marginTop: 4,
                              lineHeight: 1.4,
                            }}
                          >
                            {toolObj.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(left.tools?.length || 0) > toolsL.length && (
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        marginTop: 4,
                      }}
                    >
                      +{(left.tools?.length || 0) - toolsL.length} more tools
                      listed on main page
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  No explicit tool names declared in metadata yet. Check project
                  README on main listing page.
                </div>
              )}
            </div>

            <div
              className="surface"
              style={{ padding: '1.5rem', borderRadius: 12 }}
            >
              <h3
                style={{
                  fontSize: '1.1rem',
                  marginBottom: '0.75rem',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                }}
              >
                {nameR} Tools ({right.tools?.length || toolsR.length})
              </h3>
              {toolsR.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {toolsR.map((t: string) => {
                    const toolObj = right.tools?.find(
                      (item) => item.name === t,
                    );
                    return (
                      <div
                        key={t}
                        style={{
                          background: 'var(--bg-muted)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 8,
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: 'var(--brand-cyan)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Wrench size={12} /> {t}
                        </div>
                        {toolObj?.description && (
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-secondary)',
                              marginTop: 4,
                              lineHeight: 1.4,
                            }}
                          >
                            {toolObj.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(right.tools?.length || 0) > toolsR.length && (
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        marginTop: 4,
                      }}
                    >
                      +{(right.tools?.length || 0) - toolsR.length} more tools
                      listed on main page
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  No explicit tool names declared in metadata yet. Check project
                  README on main listing page.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Ready-to-Paste Client Configuration Snippets */}
        <section style={{ marginBottom: '3rem' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-primary)',
            }}
          >
            <Code2 size={20} color="var(--brand-cyan)" /> Ready-to-Paste Client
            Configurations
          </h2>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
            }}
          >
            Paste either (or both) of these JSON server blocks into your client
            config file (e.g. <code>claude_desktop_config.json</code> or{' '}
            <code>~/.cursor/mcp.json</code>).
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  marginBottom: '0.5rem',
                  color: 'var(--text-primary)',
                }}
              >
                {nameL} Configuration
              </div>
              <CopyBlock
                code={snippetL}
                serverId={left.id}
                title="mcpServers (Claude Desktop / Cursor)"
                language="json"
              />
            </div>

            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  marginBottom: '0.5rem',
                  color: 'var(--text-primary)',
                }}
              >
                {nameR} Configuration
              </div>
              <CopyBlock
                code={snippetR}
                serverId={right.id}
                title="mcpServers (Claude Desktop / Cursor)"
                language="json"
              />
            </div>
          </div>
        </section>

        {/* Shared FaqSection Component (Theme-Safe) */}
        <section style={{ marginBottom: '3rem' }}>
          <FaqSection
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={20} color="var(--brand-cyan)" /> Frequently
                Asked Questions
              </span>
            }
            renderJsonLd={false}
            items={[
              {
                question: `What is the main functional difference between ${nameL} and ${nameR}?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    {nameL} is categorized under <strong>{catL}</strong> and
                    uses a{' '}
                    <strong>
                      {installL.kind === 'remote'
                        ? 'remote streaming HTTP/SSE transport'
                        : 'local stdio subprocess'}
                    </strong>
                    . In contrast, {nameR} belongs to <strong>{catR}</strong>{' '}
                    using{' '}
                    <strong>
                      {installR.kind === 'remote'
                        ? 'remote streaming HTTP/SSE transport'
                        : 'local stdio subprocess'}
                    </strong>
                    . Select {nameL} when you need capabilities focused on{' '}
                    {catL.toLowerCase()} and {nameR} when you require tools for{' '}
                    {catR.toLowerCase()}.
                  </p>
                ),
              },
              {
                question: `How do I install ${nameL} or ${nameR} in Claude Desktop, Cursor, or Windsurf?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    Both servers follow the standard Model Context Protocol
                    configuration format. Simply copy the JSON block from the
                    configuration section above and paste it into your AI
                    client's <code>mcpServers</code> configuration object (for
                    instance in <code>claude_desktop_config.json</code> or{' '}
                    <code>~/.cursor/mcp.json</code>), then completely restart or
                    refresh the application.
                  </p>
                ),
              },
              {
                question: `Are ${nameL} and ${nameR} free to use, or do they require API keys?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    {nameL} is listed under a{' '}
                    <strong>{formatPricingLabel(left.pricingModel)}</strong>{' '}
                    model with <strong>{formatAuthLabel(left.authType)}</strong>
                    .{nameR} operates under a{' '}
                    <strong>{formatPricingLabel(right.pricingModel)}</strong>{' '}
                    model with{' '}
                    <strong>{formatAuthLabel(right.authType)}</strong>. If
                    environment variables are required (such as API keys), be
                    sure to define them under the <code>env</code> key in your
                    MCP client's configuration file.
                  </p>
                ),
              },
              {
                question: `Can I run both ${nameL} and ${nameR} at the same time in my AI client?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    Yes! MCP clients support multi-server orchestration. You can
                    include both <code>{left.id}</code> and{' '}
                    <code>{right.id}</code> as distinct keys inside the single{' '}
                    <code>mcpServers</code> object in your configuration file.
                    Your AI assistant will automatically select and call the
                    appropriate tool from either server during chat sessions.
                  </p>
                ),
              },
              {
                question: `Which MCP server has higher directory engagement and quality ratings?`,
                answer: (
                  <p style={{ margin: 0 }}>
                    On AllMCPs, {nameL} has a Quality Score of{' '}
                    <strong>
                      {qL.score}/100 ({qL.tier})
                    </strong>{' '}
                    with {(left.views || 0).toLocaleString()} views,{' '}
                    {(left.copies || 0).toLocaleString()} installs, and{' '}
                    {(left.githubStars || 0).toLocaleString()} GitHub stars.
                    {nameR} holds a Quality Score of{' '}
                    <strong>
                      {qR.score}/100 ({qR.tier})
                    </strong>{' '}
                    with {(right.views || 0).toLocaleString()} views,{' '}
                    {(right.copies || 0).toLocaleString()} installs, and{' '}
                    {(right.githubStars || 0).toLocaleString()} GitHub stars.
                  </p>
                ),
              },
            ]}
          />
        </section>

        {/* Alternative Links & Category Hub Navigation */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '2.5rem',
          }}
        >
          <Link
            href={`/mcp/${left.id}/alternatives`}
            className="btn btn-secondary"
          >
            More alternatives to {nameL}
          </Link>
          <Link
            href={`/mcp/${right.id}/alternatives`}
            className="btn btn-secondary"
          >
            More alternatives to {nameR}
          </Link>
          <Link
            href={`/categories/${categorySlug(left.category)}`}
            className="btn btn-secondary"
          >
            {catL} category hub
          </Link>
          {id !== c0 && (
            <Link
              href={`/mcp/${c0}/vs/${c1}`}
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                alignSelf: 'center',
              }}
            >
              Canonical compare URL
            </Link>
          )}
        </div>

        {/* Peer Comparisons for Both Servers */}
        {(moreAltsLeft.length > 0 || moreAltsRight.length > 0) && (
          <section
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '2rem',
            }}
          >
            <h2
              style={{
                fontSize: '1.35rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--text-primary)',
              }}
            >
              <Layers size={20} color="var(--brand-cyan)" /> Related MCP Server
              Comparisons
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {moreAltsLeft.length > 0 && (
                <div>
                  <h3
                    style={{
                      fontSize: '1rem',
                      marginBottom: '0.75rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Popular comparisons with {nameL}
                  </h3>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    {moreAltsLeft.map((alt) => {
                      const n = parseServerName(alt.name).displayName;
                      const [a0, a1] = canonicalPair(left.id, alt.id);
                      return (
                        <li key={alt.id}>
                          <Link
                            href={`/mcp/${a0}/vs/${a1}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.75rem 1rem',
                              borderRadius: 10,
                              border: '1px solid var(--border-color)',
                              textDecoration: 'none',
                              color: 'inherit',
                              background: 'var(--bg-muted)',
                            }}
                          >
                            <ServerAvatar
                              name={alt.name}
                              logoUrl={alt.logoUrl}
                              size={28}
                            />
                            <span
                              style={{
                                fontWeight: 600,
                                flex: 1,
                                fontSize: '0.9rem',
                              }}
                            >
                              {nameL} vs {n}
                            </span>
                            <ChevronRight
                              size={16}
                              style={{ color: 'var(--text-secondary)' }}
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {moreAltsRight.length > 0 && (
                <div>
                  <h3
                    style={{
                      fontSize: '1rem',
                      marginBottom: '0.75rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Popular comparisons with {nameR}
                  </h3>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    {moreAltsRight.map((alt) => {
                      const n = parseServerName(alt.name).displayName;
                      const [a0, a1] = canonicalPair(right.id, alt.id);
                      return (
                        <li key={alt.id}>
                          <Link
                            href={`/mcp/${a0}/vs/${a1}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.75rem 1rem',
                              borderRadius: 10,
                              border: '1px solid var(--border-color)',
                              textDecoration: 'none',
                              color: 'inherit',
                              background: 'var(--bg-muted)',
                            }}
                          >
                            <ServerAvatar
                              name={alt.name}
                              logoUrl={alt.logoUrl}
                              size={28}
                            />
                            <span
                              style={{
                                fontWeight: 600,
                                flex: 1,
                                fontSize: '0.9rem',
                              }}
                            >
                              {nameR} vs {n}
                            </span>
                            <ChevronRight
                              size={16}
                              style={{ color: 'var(--text-secondary)' }}
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
