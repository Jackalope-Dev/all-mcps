import { FolderGit2, Globe, Terminal, ChevronRight, BadgeCheck, Sparkles, Crown } from 'lucide-react';
import Link from 'next/link';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import ShareModal from '../../../components/ShareModal';
import { Badge } from '../../../components/ui/Badge';
import { CopyBlock } from '../../../components/ui/CopyBlock';
import { McpConfigGenerator } from '../../../components/McpConfigGenerator';
import { AgentPromptButton } from '../../../components/ui/AgentPromptButton';
import { ViewTracker, InstallsStat } from '../../../components/ui/ViewTracker';
import { UpvoteButton } from '../../../components/ui/UpvoteButton';
import serversData from '../../../data/mcp-servers.json';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { repoLinkRel, websiteLinkRel } from '../../../lib/linkRel';
import { PremiumUpgrade } from '../../../components/PremiumUpgrade';
import { isFeaturedListing, isVerifiedListing } from '../../../lib/featuredStatus';
import { OutboundLink } from '../../../components/ui/OutboundLink';
import { getRelatedServers, getFeaturedServers, PUBLIC_SERVER_COLUMNS } from '../../../lib/servers';
import { auth } from '../../../lib/auth';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { parseServerName } from '../../../lib/displayName';
import { ImpressionBeacon } from '../../../components/ImpressionTracker';

// Define the type for our server data
type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  isPremium?: boolean;
  featuredUntil?: string | Date | null;
  websiteVerified?: boolean;
  isOfficial: boolean;
  status: string;
  lastCheckedAt?: string | null;
  isVerifiedActive?: boolean;
  healthStatus?: string;
  reciprocalBadgeOk?: boolean;
  views?: number;
  copies?: number;
  upvotes?: number;
  createdAt: string;
};

async function getServer(id: string): Promise<Server | undefined> {
  // Try D1 first
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db
        .select(PUBLIC_SERVER_COLUMNS)
        .from(serversTable)
        .where(eq(serversTable.id, id))
        .limit(1);
      if (dbServers.length > 0) return dbServers[0] as unknown as Server;
    }
  } catch (e) {}

  // Fallback to the bundled JSON snapshot
  const servers = serversData as Server[];
  return servers.find((s) => s.id === id);
}

/**
 * ownerUserId is deliberately excluded from PUBLIC_SERVER_COLUMNS (see lib/servers.ts),
 * so it's queried separately here — only when a session exists — purely to compute a
 * boolean, never exposed to the client.
 */
async function checkIsOwner(id: string, userId: string): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select({ ownerUserId: serversTable.ownerUserId })
        .from(serversTable)
        .where(eq(serversTable.id, id))
        .limit(1);
      return rows[0]?.ownerUserId === userId;
    }
  } catch (e) {}
  return false;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getServer(id);
  
  if (!server) {
    return { title: 'Not Found' };
  }
  
  const desc =
    server.description.length > 155
      ? `${server.description.slice(0, 152)}...`
      : server.description;

  return {
    title: `${server.name} MCP Server - Install & Setup`,
    description: desc,
    keywords: [server.name, 'MCP server', 'Model Context Protocol', 'AI agent tool', server.category].join(', '),
    alternates: {
      canonical: `https://allmcps.com/mcp/${server.id}`,
    },
    openGraph: {
      title: `${server.name} MCP Server - Install & Setup | AllMCPs`,
      description: desc,
      url: `https://allmcps.com/mcp/${server.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${server.name} MCP Server - Install & Setup | AllMCPs`,
      description: desc,
    },
  };
}

async function fetchReadme(url: string) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    
    const owner = match[1];
    let repo = match[2];
    
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }
    
    // Attempt to fetch from 'main' branch first
    let res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`, { next: { revalidate: 3600 } });
    if (!res.ok) {
      // Fallback to 'master' branch
      res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`, { next: { revalidate: 3600 } });
    }
    
    if (res.ok) {
      return await res.text();
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Generate static params so Next.js can pre-render these pages at build time
export async function generateStaticParams() {
  const servers = serversData as Server[];
  return servers.slice(0, 50).map((server) => ({
    id: server.id,
  }));
}

export default async function MCPDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getServer(id);
  const session = await auth();
  const isOwner = session?.user?.id ? await checkIsOwner(id, session.user.id) : false;

  if (!server) {
    return (
      <main className="page-shell page-shell--status">
        <div className="page-shell-inner">
          <div className="surface page-panel">
            <div className="empty-state">
              <h1 className="empty-state-title">Server Not Found</h1>
              <p className="empty-state-body">This MCP listing may have been removed or the URL is incorrect.</p>
              <div className="empty-state-actions">
                <Link href="/browse" className="btn btn-primary">← Back to Directory</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const readme = await fetchReadme(server.url);
  const relatedServers = await getRelatedServers(server as any, 4);
  const { displayName, org } = parseServerName(server.name);

  // Drives the health dot by the display name — replaces both the old "Verified Active"
  // row badge and the big sidebar Status card with one tooltip-bearing indicator.
  const healthKey = server.isVerifiedActive
    ? 'active'
    : server.healthStatus === 'down' || server.healthStatus === 'unhealthy'
      ? 'down'
      : 'unknown';
  const healthUi = {
    active: {
      label: 'Health: Active',
      color: '#10b981',
      detail: 'Recent health check succeeded.',
    },
    down: {
      label: 'Health: Issues detected',
      color: '#f87171',
      detail: 'Last health check failed or the endpoint looked unhealthy.',
    },
    unknown: {
      label: 'Health: Not checked yet',
      color: '#a1a1aa',
      detail: 'We have not completed a health check for this listing yet.',
    },
  }[healthKey];

  // Sidebar ad slot rotates between paid featured listings and the "spotlight your own
  // server" upsell — one extra slot in the pool reserved for the upsell keeps it showing
  // occasionally even as more advertisers are in rotation.
  const featuredPool = await getFeaturedServers(server.id, 10);
  const spotlightCandidates = [...featuredPool, null];
  const spotlightPick = spotlightCandidates[Math.floor(Math.random() * spotlightCandidates.length)];
  // The mcpServers key just needs to be a readable identifier; the npx arg below
  // uses server.name verbatim since that's typically the real package name
  // (e.g. "@agentfund/mcp") and slugifying it would produce a nonexistent package.
  const installSlug = (server.name.split('/').pop() || server.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mcp-server';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: server.name,
        description: server.description,
        url: `https://allmcps.com/mcp/${server.id}`,
        sameAs: server.url,
        codeRepository: server.url,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        softwareRequirements: 'Node.js, npx, Claude Desktop or MCP compatible client',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `How do I install the ${server.name} MCP server?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Add the following block to your claude_desktop_config.json under mcpServers: "mcpServers": { "${installSlug}": { "command": "npx", "args": ["-y", "${server.name}"] } }`,
            },
          },
          {
            '@type': 'Question',
            name: `What does ${server.name} do?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: server.description,
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://allmcps.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: server.category,
            item: `https://allmcps.com/browse?category=${encodeURIComponent(server.category)}`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: server.name,
            item: `https://allmcps.com/mcp/${server.id}`,
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
      <main className="container page-shell" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
        <ol className="breadcrumb">
          <li><Link href="/">Home</Link></li>
          <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
          <li><Link href={`/browse?category=${encodeURIComponent(server.category)}`}>{server.category}</Link></li>
          <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
          <li className="breadcrumb-current">{displayName}</li>
        </ol>
      </nav>

      <div className="detail-grid">

        {/* Main Content (Left Column) */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: org ? '0.2rem' : '1rem' }}>
            <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={56} />
            <span className="mcp-icon-tooltip">
              <span className="mcp-icon-tooltip-trigger" tabIndex={0}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: healthUi.color,
                    boxShadow: healthKey === 'active' ? `0 0 8px ${healthUi.color}` : 'none',
                    flexShrink: 0,
                  }}
                />
              </span>
              <span className="mcp-icon-tooltip-bubble" role="tooltip">
                <span className="mcp-icon-tooltip-title">
                  <span className="mcp-icon-tooltip-dot" style={{ backgroundColor: healthUi.color }} />
                  {healthUi.label}
                </span>
                <span className="mcp-icon-tooltip-body">{healthUi.detail}</span>
                <span className="mcp-icon-tooltip-meta">
                  {server.lastCheckedAt
                    ? `Last checked ${new Date(server.lastCheckedAt).toLocaleString()}`
                    : 'No health check has run yet.'}
                </span>
              </span>
            </span>
            <h1 className="text-page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem' }}>
              {displayName}
              {server.isPremium && (
                <span className="mcp-icon-tooltip">
                  <span className="mcp-icon-tooltip-trigger" tabIndex={0}>
                    <Crown size={20} color="#facc15" fill="#facc15" />
                  </span>
                  <span className="mcp-icon-tooltip-bubble" role="tooltip">
                    <span className="mcp-icon-tooltip-title">
                      <Crown size={14} color="#facc15" fill="#facc15" /> Premium listing
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      This owner pays for enhanced visibility — priority placement in search, category pages, and rotating spotlight slots across the directory.
                    </span>
                  </span>
                </span>
              )}
              {isVerifiedListing(server) && (
                <span className="mcp-icon-tooltip">
                  <span className="mcp-icon-tooltip-trigger" tabIndex={0}>
                    <BadgeCheck size={20} color="var(--accent-color)" />
                  </span>
                  <span className="mcp-icon-tooltip-bubble" role="tooltip">
                    <span className="mcp-icon-tooltip-title">
                      <BadgeCheck size={14} color="var(--accent-color)" />
                      {server.isOfficial ? 'Ownership verified' : 'Premium listing'}
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      {server.isOfficial
                        ? 'The owner proved control of this listing via a GitHub README, site badge, or DNS TXT record.'
                        : 'This listing has an active Premium subscription. Ownership has not been separately verified.'}
                    </span>
                  </span>
                </span>
              )}
            </h1>
          </div>
          {org && (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              {org}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <Badge variant="category" href={`/browse?category=${encodeURIComponent(server.category)}`}>
              {server.category}
            </Badge>
            {server.websiteVerified && (
              <Badge variant="success">Website verified</Badge>
            )}
            {isFeaturedListing(server) && (
              <Badge
                variant="success"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,123,255,0.12))',
                  color: '#00E5FF',
                  borderColor: 'rgba(0,229,255,0.35)',
                }}
              >
                ★ Featured
              </Badge>
            )}
          </div>
          <div className="listing-metrics-row" style={{ marginBottom: '1.5rem' }}>
            <ViewTracker serverId={server.id} initialCount={server.views || 0} />
            <InstallsStat count={server.copies || 0} />
            <UpvoteButton serverId={server.id} initialCount={server.upvotes || 0} />
            <ShareModal serverId={server.id} serverName={server.name} variant="mini" />
          </div>
          
          <div style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
            <SafeMarkdown content={server.description} utmContent={server.id} />
          </div>

          <div className="surface" style={{ padding: '2rem', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={20} /> Quick Install
            </h2>
            <McpConfigGenerator serverId={server.id} serverName={server.name} url={server.url} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
              Using an AI coding agent (Claude Code, Cursor, etc.)? Copy a ready-made prompt that tells it to fetch the setup instructions and install this server for you.
            </p>
            <AgentPromptButton serverId={server.id} serverName={server.name} />
          </div>

          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Documentation Overview</h2>
            <div className="detail-readme-scroll">
              <div className="markdown-body">
                {readme ? (
                  <SafeMarkdown content={readme} utmContent={server.id} />
                ) : (
                  <p>No README found or this server is not hosted on GitHub.</p>
                )}
              </div>
            </div>
          </div>

          {/* Related MCP Servers */}
          {relatedServers && relatedServers.length > 0 && (
            <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Related MCP Servers
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.25rem' }}>
                {relatedServers.map((rel) => {
                  const relName = parseServerName(rel.name).displayName;
                  return (
                  <Link
                    key={rel.id}
                    href={`/mcp/${rel.id}`}
                    className="surface-interactive"
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      position: 'relative',
                      border: isFeaturedListing(rel as any) ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid var(--border-color)',
                      background: isFeaturedListing(rel as any)
                        ? 'linear-gradient(135deg, rgba(0,229,255,0.06), rgba(0,123,255,0.04))'
                        : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                        <ServerAvatar name={rel.name} logoUrl={rel.logoUrl} size={32} />
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {relName}
                        </span>
                      </div>
                      {isFeaturedListing(rel as any) ? (
                        <Badge variant="success" style={{ background: 'rgba(0,229,255,0.15)', color: '#00E5FF', borderColor: 'rgba(0,229,255,0.3)', fontSize: '0.65rem', flexShrink: 0 }}>
                          ★ Featured
                        </Badge>
                      ) : rel.isOfficial ? (
                        <Badge variant="official" style={{ fontSize: '0.65rem', flexShrink: 0 }}>Verified</Badge>
                      ) : null}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 }}>
                      <SafeMarkdown content={rel.description || 'No description provided.'} isInline />
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                      <Badge variant="category" style={{ fontSize: '0.7rem' }}>{rel.category}</Badge>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {(rel.views || 0).toLocaleString()} views
                      </span>
                    </div>
                  </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar (Right Column) */}
        <div className="detail-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {isOwner && (
            <div className="surface" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engagement</h3>
              <dl className="listing-engagement-dl">
                <div>
                  <dt>Views</dt>
                  <dd>{(server.views || 0).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Installs</dt>
                  <dd>{(server.copies || 0).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Upvotes</dt>
                  <dd>{(server.upvotes || 0).toLocaleString()}</dd>
                </div>
              </dl>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.85rem', lineHeight: 1.45 }}>
                Views and upvotes are unique per visitor network (hashed IP). Installs count copy actions.
              </p>
            </div>
          )}

          {/* Sidebar Highlight / Ad Slot (Top of Sidebar Column) — rotates between paid
              featured listings and the self-serve upsell */}
          {spotlightPick ? (
            (() => {
              const { displayName: spotlightName } = parseServerName(spotlightPick.name);
              return (
                <ImpressionBeacon serverId={spotlightPick.id} surface="detail_sidebar">
                  <div
                    className="surface"
                    style={{
                      padding: '1.5rem',
                      borderColor: 'rgba(0, 229, 255, 0.35)',
                      background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 123, 255, 0.04) 100%)',
                      boxShadow: '0 0 20px rgba(0, 229, 255, 0.1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <Badge variant="success" style={{ background: 'rgba(0,229,255,0.15)', color: '#00E5FF', borderColor: 'rgba(0,229,255,0.35)', fontSize: '0.7rem' }}>
                        ★ Featured
                      </Badge>
                      <ServerAvatar name={spotlightPick.name} logoUrl={spotlightPick.logoUrl} size={32} />
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                      {spotlightName}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1rem',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {spotlightPick.description}
                    </p>
                    <Link
                      href={`/mcp/${spotlightPick.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.75rem 1rem',
                        background: 'linear-gradient(135deg, #00E5FF, #007BFF)',
                        color: '#090d16',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        textDecoration: 'none',
                      }}
                    >
                      <Sparkles size={16} /> View Server
                    </Link>
                    <Link
                      href="/submit"
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        marginTop: '0.65rem',
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                      }}
                    >
                      Feature your own server →
                    </Link>
                  </div>
                </ImpressionBeacon>
              );
            })()
          ) : (
            <div
              className="surface"
              style={{
                padding: '1.5rem',
                borderColor: 'rgba(0, 229, 255, 0.35)',
                background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 123, 255, 0.04) 100%)',
                boxShadow: '0 0 20px rgba(0, 229, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <Badge variant="success" style={{ background: 'rgba(0,229,255,0.15)', color: '#00E5FF', borderColor: 'rgba(0,229,255,0.35)', fontSize: '0.7rem' }}>
                  ★ Spotlight Slot
                </Badge>
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Feature Your MCP Server
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                Get maximum visibility for your server across our directory, search results, and detail pages.
              </p>
              <Link
                href="/submit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.75rem 1rem',
                  background: 'linear-gradient(135deg, #00E5FF, #007BFF)',
                  color: '#090d16',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
              >
                <Sparkles size={16} /> Spotlight Your Server
              </Link>
            </div>
          )}

          <div className="surface" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <OutboundLink
                href={server.url}
                destinationType="github"
                serverId={server.id}
                target="_blank"
                rel={repoLinkRel(!!server.isPremium, !!server.isOfficial)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 500, transition: 'background 0.2s', border: '1px solid var(--border-color)' }}
                className="nav-link"
              >
                <FolderGit2 size={18} /> View Repository
              </OutboundLink>
              {server.websiteUrl && (
                <OutboundLink
                  href={server.websiteUrl}
                  destinationType="website"
                  serverId={server.id}
                  target="_blank"
                  rel={websiteLinkRel(!!server.isPremium, !!server.reciprocalBadgeOk)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 500, transition: 'background 0.2s', border: '1px solid var(--border-color)' }}
                  className="nav-link"
                >
                  <Globe size={18} /> Website
                </OutboundLink>
              )}
            </div>
          </div>

          {!server.isOfficial ? (
            <div className="surface" style={{ padding: '1.5rem', borderColor: 'rgba(0,229,255,0.35)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <BadgeCheck size={18} color="var(--accent-color)" /> Own this project?
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.55 }}>
                This directory is pre-filled from public sources. Claim via GitHub README, site badge, or DNS TXT to get the verified badge
                {server.websiteUrl ? '' : ' and attach your website'}.
              </p>
              <Link
                href={`/mcp/${server.id}/claim`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.75rem 1rem',
                  background: 'var(--brand-gradient)',
                  color: 'var(--bg-color)',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                <Sparkles size={16} /> Claim this listing
              </Link>
            </div>
          ) : (
            isOwner && (
              <div className="surface" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Globe size={18} color="var(--accent-color)" /> Listing owner
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.55 }}>
                  {server.websiteUrl
                    ? server.websiteVerified
                      ? 'Website is attached and verified. You can re-verify or change it anytime.'
                      : 'Website is attached but not verified yet — prove control for a stronger listing.'
                    : 'Add your product site, then verify with a badge or DNS TXT.'}
                </p>

                {server.websiteUrl && (() => {
                  const dofollow = !!server.isPremium || !!server.reciprocalBadgeOk;
                  return (
                    <div
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        background: dofollow ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${dofollow ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`,
                      }}
                    >
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: dofollow ? '#34d399' : 'var(--text-secondary)', marginBottom: dofollow ? 0 : '0.5rem' }}>
                        {dofollow
                          ? `Website link is dofollow${server.isPremium ? ' — Premium' : ' — reciprocal badge verified'}`
                          : 'Website link is nofollow'}
                      </p>
                      {!dofollow && (
                        <>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                            Add the AllMCPs badge to your site and verify it to earn a free dofollow backlink — rechecked periodically to stay live. Premium listings get dofollow instantly, no badge required.
                          </p>
                          <Link
                            href={`/mcp/${server.id}/claim`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.5rem 0.85rem',
                              background: 'rgba(0,229,255,0.1)',
                              border: '1px solid rgba(0,229,255,0.3)',
                              color: '#00E5FF',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                            }}
                          >
                            <Sparkles size={14} /> Get a free dofollow link
                          </Link>
                        </>
                      )}
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <Link
                    href={`/mcp/${server.id}/claim`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    Manage website &amp; verification
                  </Link>
                  <Link
                    href={`/dashboard?edit=${server.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '0.75rem 1rem',
                      background: 'var(--brand-gradient)',
                      color: 'var(--bg-color)',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                  >
                    Manage listing
                  </Link>
                </div>
              </div>
            )
          )}

          {server.status === 'active' && (
            <PremiumUpgrade
              serverId={server.id}
              listingStatus={server.status}
              isPremium={!!server.isPremium}
            />
          )}

          <div className="surface" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Share & Embed</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Add our SVG badge (dark/light directory styles) or embeddable widget to your site.</p>
            <ShareModal serverId={server.id} serverName={server.name} />
          </div>
          
        </div>
      </div>
    </main>
    </>
  );
}
