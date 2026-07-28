import { FolderGit2, Globe, Terminal, ChevronRight, BadgeCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import ShareModal from '../../../components/ShareModal';
import { Badge } from '../../../components/ui/Badge';
import { CopyBlock } from '../../../components/ui/CopyBlock';
import { AgentPromptButton } from '../../../components/ui/AgentPromptButton';
import { ViewTracker, InstallsStat } from '../../../components/ui/ViewTracker';
import { UpvoteButton } from '../../../components/ui/UpvoteButton';
import serversData from '../../../data/mcp-servers.json';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { repoLinkRel, websiteLinkRel } from '../../../lib/linkRel';
import { PremiumUpgrade } from '../../../components/PremiumUpgrade';
import { isFeaturedListing } from '../../../lib/featuredStatus';

// Define the type for our server data
type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  websiteUrl?: string | null;
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
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.id, id)).limit(1);
      if (dbServers.length > 0) return dbServers[0] as unknown as Server;
    }
  } catch (e) {}

  // Fallback to the bundled JSON snapshot
  const servers = serversData as Server[];
  return servers.find((s) => s.id === id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getServer(id);
  
  if (!server) {
    return { title: 'Not Found' };
  }
  
  return {
    title: `${server.name} MCP Server - Install & Setup`,
    description: server.description,
    keywords: [server.name, 'MCP server', 'Model Context Protocol', 'AI agent tool', server.category].join(', '),
    alternates: {
      canonical: `https://allmcps.com/mcp/${server.id}`,
    },
    openGraph: {
      title: `${server.name} MCP Server - Install & Setup | AllMCPs`,
      description: server.description,
      url: `https://allmcps.com/mcp/${server.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${server.name} MCP Server - Install & Setup | AllMCPs`,
      description: server.description,
    }
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
          <li className="breadcrumb-current">{server.name}</li>
        </ol>
      </nav>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '3rem', alignItems: 'start' }}>
        
        {/* Main Content (Left Column) */}
        <div style={{ minWidth: 0 }}>
          <h1 className="text-page-title" style={{ margin: '0 0 1rem 0' }}>{server.name}</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <Badge variant="category" href={`/browse?category=${encodeURIComponent(server.category)}`}>
              {server.category}
            </Badge>
            {(server.isOfficial || server.isPremium) && (
              <Badge variant="official" title={server.isPremium && !server.isOfficial ? 'Premium listing' : 'Ownership verified'}>
                ✓ Verified
              </Badge>
            )}
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
            {server.isPremium && (
              <Badge variant="success" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', borderColor: 'rgba(0,229,255,0.25)' }}>
                Premium
              </Badge>
            )}
            {server.isVerifiedActive && (
              <Badge variant="success" title={server.lastCheckedAt ? `Last checked: ${new Date(server.lastCheckedAt).toLocaleString()}` : 'Recently checked'}>
                🟢 Verified Active
              </Badge>
            )}
          </div>
          <div className="listing-metrics-row" style={{ marginBottom: '1.5rem' }}>
            <ViewTracker serverId={server.id} initialCount={server.views || 0} />
            <InstallsStat count={server.copies || 0} />
            <UpvoteButton serverId={server.id} initialCount={server.upvotes || 0} />
          </div>
          
          <div style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
            <SafeMarkdown content={server.description} utmContent={server.id} />
          </div>

          <div className="surface" style={{ padding: '2rem', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={20} /> Quick Install (Claude Desktop)
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>Add this directly to your <code>claude_desktop_config.json</code> file:</p>
            <CopyBlock code={`"mcpServers": {\n  "${installSlug}": {\n    "command": "npx",\n    "args": ["-y", "${server.name}"]\n  }\n}`} serverId={server.id} />

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
        </div>

        {/* Sidebar (Right Column) */}
        <div className="detail-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
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

          <div className="surface" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</h3>
            {(() => {
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

              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: healthUi.color,
                        boxShadow: healthKey === 'active' ? `0 0 10px ${healthUi.color}` : 'none',
                        flexShrink: 0,
                      }}
                    />
                    {healthUi.label}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 0.75rem' }}>
                    {healthUi.detail}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {server.lastCheckedAt
                      ? `Last checked: ${new Date(server.lastCheckedAt).toLocaleString()}`
                      : 'No check timestamp yet.'}
                  </p>
                  <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {server.isOfficial || server.isPremium ? (
                      <span>
                        <strong style={{ color: '#34d399' }}>Verified listing</strong>
                        {server.isPremium ? ' · Premium' : ''}
                        {server.websiteVerified ? ' · Website verified' : ''}
                      </span>
                    ) : (
                      <span>
                        Unclaimed listing (imported or pending owner verification).{' '}
                        <Link href={`/mcp/${server.id}/claim`} style={{ color: 'var(--accent-color)' }}>
                          Claim it →
                        </Link>
                      </span>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="surface" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a
                href={server.url}
                target="_blank"
                rel={repoLinkRel(!!server.isPremium, !!server.isOfficial)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 500, transition: 'background 0.2s', border: '1px solid var(--border-color)' }}
                className="nav-link"
              >
                <FolderGit2 size={18} /> View Repository
              </a>
              {server.websiteUrl && (
                <a
                  href={server.websiteUrl}
                  target="_blank"
                  rel={websiteLinkRel(!!server.isPremium, !!server.reciprocalBadgeOk)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 500, transition: 'background 0.2s', border: '1px solid var(--border-color)' }}
                  className="nav-link"
                >
                  <Globe size={18} /> Website
                  {server.isPremium || server.reciprocalBadgeOk ? (
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#00E5FF', fontWeight: 700 }}>DOFOLLOW</span>
                  ) : (
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>nofollow</span>
                  )}
                </a>
              )}
            </div>
            {!server.isPremium && server.websiteUrl && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.5 }}>
                Free listings use nofollow website links. Premium listings get a dofollow backlink.
              </p>
            )}
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
            </div>
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
