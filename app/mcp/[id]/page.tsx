import { FolderGit2, Globe, Terminal, ChevronRight, BadgeCheck, Sparkles, Crown, Star, Download, Wrench, ExternalLink } from 'lucide-react';
import { QualityBadge } from '../../../components/ui/QualityBadge';
import Link from 'next/link';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import ShareModal from '../../../components/ShareModal';
import { Badge } from '../../../components/ui/Badge';
import { CopyBlock } from '../../../components/ui/CopyBlock';
import { McpConfigGenerator } from '../../../components/McpConfigGenerator';
import { ClientConfigTabs } from '../../../components/ClientConfigTabs';
import { AgentPromptButton } from '../../../components/ui/AgentPromptButton';
import { InstallButtons } from '../../../components/ui/InstallButtons';
import { ViewTracker, InstallsStat } from '../../../components/ui/ViewTracker';
import { UpvoteButton } from '../../../components/ui/UpvoteButton';
import serversData from '../../../data/mcp-servers.json';
import { notFound } from 'next/navigation';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { repoLinkRel, websiteLinkRel } from '../../../lib/linkRel';
import { PremiumUpgrade } from '../../../components/PremiumUpgrade';
import { isFeaturedListing, isVerifiedListing } from '../../../lib/featuredStatus';
import { OutboundLink } from '../../../components/ui/OutboundLink';
import { getRelatedServers, getFeaturedServers, getServerById, type Server } from '../../../lib/servers';
import { auth } from '../../../lib/auth';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { IconTooltip } from '../../../components/ui/IconTooltip';
import { parseServerName } from '../../../lib/displayName';
import { ImpressionBeacon } from '../../../components/ImpressionTracker';
import { bestTopicForCategory } from '../../../lib/bestTopics';
import { categorySlug, getCategoryMeta } from '../../../lib/categories';
import { ToolSchemaInspector } from '../../../components/ui/ToolSchemaInspector';

// Listing shape and the D1-with-JSON-fallback fetch (incl. README-chrome
// sanitization) live in lib/servers so every page/route stays consistent.
const getServer = getServerById;

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
    // A missing listing must not return a 200 "Not Found" body (soft 404) — mark it
    // noindex here and serve a real 404 from the page component below.
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }

  // Prefer the LLM-written one-liner for the meta description — it's a clean, unique
  // sentence, whereas the raw description is often scraped chrome. Better CTR + no
  // duplicate-snippet penalty against the upstream repo.
  const metaSource = (server.aiSummary && server.aiSummary.trim()) || server.description;
  const desc =
    metaSource.length > 155 ? `${metaSource.slice(0, 152)}...` : metaSource;

  return {
    title: `${server.name} MCP Server - Install & Setup`,
    description: desc,
    keywords: [server.name, 'MCP server', 'Model Context Protocol', 'AI agent tool', server.category].join(', '),
    alternates: {
      canonical: `https://allmcps.com/mcp/${server.id}`,
      // Expose the agent-readable markdown representation so LLM crawlers and
      // MCP-aware clients can discover the plain-text version of this listing.
      types: {
        'text/markdown': `https://allmcps.com/api/v1/mcp/${server.id}/markdown`,
      },
    },
    openGraph: {
      type: 'article',
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
    // Serve a genuine HTTP 404 (via app/not-found.tsx) instead of a 200 page with a
    // "not found" body — the latter is a soft 404 that wastes crawl budget and can get
    // an empty URL indexed.
    notFound();
  }

  const readme = await fetchReadme(server.url);
  const relatedServers = await getRelatedServers(server as any, 4);
  const { displayName, org } = parseServerName(server.name);
  const catMeta = getCategoryMeta(server.category);

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

  // Human-readable repo host (e.g. "GitHub", "GitLab") for the no-README fallback copy.
  const repoHost = (() => {
    try {
      const h = new URL(server.url).hostname.replace(/^www\./, '');
      if (h.includes('github')) return 'GitHub';
      if (h.includes('gitlab')) return 'GitLab';
      if (h.includes('bitbucket')) return 'Bitbucket';
      return h;
    } catch {
      return '';
    }
  })();

  const canonicalUrl = `https://allmcps.com/mcp/${server.id}`;
  // The route-generated OG card always exists for every listing, so it's a safe,
  // stable image for structured data (Google requires an image for the richest
  // SoftwareApplication results, and answer engines surface it in citations).
  const ogImage = `${canonicalUrl}/opengraph-image`;
  const sameAs = [server.url, server.websiteUrl].filter(Boolean) as string[];
  const publishedDate = server.createdAt ? new Date(server.createdAt) : null;
  const publishedIso =
    publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : undefined;
  // Map real engagement counters to schema.org InteractionCounter — never a
  // fabricated aggregateRating, which we don't collect and which risks penalties.
  const interactionStatistic = [
    server.views
      ? { '@type': 'InteractionCounter', interactionType: 'https://schema.org/ViewAction', userInteractionCount: server.views }
      : null,
    server.copies
      ? { '@type': 'InteractionCounter', interactionType: 'https://schema.org/InstallAction', userInteractionCount: server.copies }
      : null,
    server.upvotes
      ? { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: server.upvotes }
      : null,
  ].filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: server.name,
        description: server.description,
        url: canonicalUrl,
        mainEntityOfPage: canonicalUrl,
        image: ogImage,
        sameAs,
        codeRepository: server.url,
        applicationCategory: 'DeveloperApplication',
        applicationSubCategory: 'Model Context Protocol Server',
        operatingSystem: 'Cross-platform',
        softwareRequirements: 'Node.js, npx, Claude Desktop or MCP compatible client',
        isAccessibleForFree: true,
        keywords: [server.name, 'MCP server', 'Model Context Protocol', 'AI agent tool', server.category].join(', '),
        ...(publishedIso ? { datePublished: publishedIso } : {}),
        ...(org ? { author: { '@type': 'Organization', name: org, ...(server.url ? { url: server.url } : {}) } } : {}),
        provider: {
          '@type': 'Organization',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        ...(interactionStatistic.length ? { interactionStatistic } : {}),
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
          {
            '@type': 'Question',
            name: `Is the ${server.name} MCP server free to use?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Yes. ${server.name} is listed on AllMCPs as a free, open Model Context Protocol server you can install into Claude Desktop, Cursor, or any MCP-compatible client.`,
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
            <IconTooltip
              label={`Health status: ${healthUi.label}`}
              trigger={
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
              }
            >
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
            </IconTooltip>
            <h1 className="text-page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>{displayName}</span>
              <Badge
                variant="category"
                href={`/browse?category=${encodeURIComponent(server.category)}`}
                style={{
                  background: catMeta.bgTint,
                  color: catMeta.color,
                  borderColor: catMeta.borderTint,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  verticalAlign: 'middle',
                }}
              >
                <span aria-hidden="true">{catMeta.emoji}</span>
                <span>{catMeta.label}</span>
              </Badge>
              {server.isPremium && (
                <IconTooltip
                  label="Premium listing"
                  trigger={<Crown size={20} color="#facc15" fill="#facc15" />}
                >
                  <span className="mcp-icon-tooltip-title">
                    <Crown size={14} color="#facc15" fill="#facc15" /> Premium listing
                  </span>
                  <span className="mcp-icon-tooltip-body">
                    This owner pays for enhanced visibility — priority placement in search, category pages, and rotating spotlight slots across the directory.
                  </span>
                </IconTooltip>
              )}
              {isVerifiedListing(server) && (
                <IconTooltip
                  label={server.isOfficial ? 'Ownership verified' : 'Premium listing'}
                  trigger={<BadgeCheck size={20} color="var(--accent-color)" />}
                >
                  <span className="mcp-icon-tooltip-title">
                    <BadgeCheck size={14} color="var(--accent-color)" />
                    {server.isOfficial ? 'Ownership verified' : 'Premium listing'}
                  </span>
                  <span className="mcp-icon-tooltip-body">
                    {server.isOfficial
                      ? 'The owner proved control of this listing via a GitHub README, site badge, or DNS TXT record.'
                      : 'This listing has an active Premium subscription. Ownership has not been separately verified.'}
                  </span>
                </IconTooltip>
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
            </h1>
          </div>
          {org && (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              {org}
            </div>
          )}

          {/* Engagement Metrics & Action Buttons (Views, Installs, Upvote, Share) */}
          <div className="listing-metrics-row">
            <ViewTracker serverId={server.id} initialCount={server.views || 0} />
            <InstallsStat count={server.copies || 0} />
            <UpvoteButton serverId={server.id} initialCount={server.upvotes || 0} />
            <ShareModal serverId={server.id} serverName={server.name} variant="mini" />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
            <OutboundLink
              href={server.url}
              destinationType="github"
              serverId={server.id}
              target="_blank"
              rel={repoLinkRel(!!server.isPremium, !!server.isOfficial)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                padding: '0.5rem 1.25rem',
                minHeight: '42px',
                boxSizing: 'border-box',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '0.9rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                textDecoration: 'none',
              }}
            >
              <FolderGit2 size={18} style={{ color: 'var(--accent-color)' }} />
              <span>View Repository</span>
              {typeof server.githubStars === 'number' && server.githubStars > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(250, 204, 21, 0.15)',
                    color: '#facc15',
                    border: '1px solid rgba(250, 204, 21, 0.3)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    marginLeft: '0.2rem',
                    lineHeight: 1,
                  }}
                >
                  <Star size={12} fill="#facc15" color="#facc15" />
                  {server.githubStars >= 1000 ? `${(server.githubStars / 1000).toFixed(1)}k` : server.githubStars.toLocaleString()}
                </span>
              )}
            </OutboundLink>

            {server.websiteUrl && (
              <OutboundLink
                href={server.websiteUrl}
                destinationType="website"
                serverId={server.id}
                target="_blank"
                rel={websiteLinkRel(!!server.isPremium, !!server.reciprocalBadgeOk)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  padding: '0.5rem 1.25rem',
                  minHeight: '42px',
                  boxSizing: 'border-box',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(0, 123, 255, 0.12))',
                  border: '1px solid rgba(0, 229, 255, 0.45)',
                  color: '#00E5FF',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 12px rgba(0, 229, 255, 0.18)',
                  textDecoration: 'none',
                }}
              >
                <Globe size={18} color="#00E5FF" />
                <span>Visit Website</span>
                <ExternalLink size={14} style={{ opacity: 0.85 }} />
              </OutboundLink>
            )}
          </div>
          
          <div style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
            <SafeMarkdown content={(server.aiSummary && server.aiSummary.trim()) || server.description} utmContent={server.id} />
          </div>

          {/* AI-authored content layer — the unique, human-useful copy that makes this page
              worth ranking (and reading) instead of just mirroring the upstream README.
              Rendered only when the ai-content cron has enriched this listing. */}
          {(server.aiOverview ||
            (server.aiUseCases?.length ?? 0) > 0 ||
            (server.aiFeatures?.length ?? 0) > 0) && (
            <div style={{ marginBottom: '3rem' }}>
              {server.aiOverview && (
                <>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Overview
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '1rem', margin: '0 0 2rem' }}>
                    {server.aiOverview}
                  </p>
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
                {(server.aiUseCases?.length ?? 0) > 0 && (
                  <div className="surface" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={16} style={{ color: 'var(--accent-color)' }} /> Use cases
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                      {server.aiUseCases!.map((uc) => (
                        <li key={uc} style={{ marginBottom: '0.4rem' }}>{uc}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(server.aiFeatures?.length ?? 0) > 0 && (
                  <div className="surface" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Wrench size={16} style={{ color: 'var(--accent-color)' }} /> Key features
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                      {server.aiFeatures!.map((f) => (
                        <li key={f} style={{ marginBottom: '0.4rem' }}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div id="quick-install" className="surface" style={{ padding: '2rem', marginBottom: '3rem', scrollMarginTop: '5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={20} /> Quick Install
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem', fontSize: '0.875rem' }}>
              One click to install into your editor, or copy the config below.
            </p>
            <InstallButtons
              serverId={server.id}
              serverName={server.name}
              url={server.url}
              description={server.description}
              installKind={server.installKind}
              installCommand={server.installCommand}
              installArgs={server.installArgs}
              installPackage={server.installPackage}
              installConfidence={server.installConfidence}
            />
            <ClientConfigTabs server={server} />
            <McpConfigGenerator
              serverId={server.id}
              serverName={server.name}
              url={server.url}
              description={server.description}
              installKind={server.installKind}
              installCommand={server.installCommand}
              installArgs={server.installArgs}
              installPackage={server.installPackage}
              installConfidence={server.installConfidence}
            />

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

          <ToolSchemaInspector
            tools={server.tools}
            aiFeatures={server.aiFeatures}
            aiUseCases={server.aiUseCases}
            serverName={displayName}
          />

          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Documentation Overview</h2>
            <div className="detail-readme-scroll">
              <div className="markdown-body">
                {readme ? (
                  <SafeMarkdown content={readme} utmContent={server.id} />
                ) : (
                  <>
                    <p>
                      {displayName} is a {server.category} MCP server{org ? ` from ${org}` : ''} listed on
                      AllMCPs. {server.description}
                    </p>
                    <p>
                      We couldn&rsquo;t automatically pull a README for this listing
                      {repoHost ? ` from ${repoHost}` : ''}, so the summary above comes from its listing
                      details. To install it, use the one-click buttons or copy the config from the{' '}
                      <a href="#quick-install">Quick Install</a> section above, then open the{' '}
                      <OutboundLink
                        href={server.url}
                        destinationType="github"
                        serverId={server.id}
                        target="_blank"
                        rel={repoLinkRel(!!server.isPremium, !!server.isOfficial)}
                      >
                        source repository
                      </OutboundLink>{' '}
                      for full setup instructions, configuration options, and the tools it exposes over MCP.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Related MCP Servers */}
          {relatedServers && relatedServers.length > 0 && (
            <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Related MCP Servers
                </h2>
                <Link
                  href={`/mcp/${server.id}/alternatives`}
                  style={{ fontSize: '0.85rem', color: 'var(--accent-color)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                >
                  View all alternatives <ChevronRight size={14} />
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.25rem' }}>
                {relatedServers.map((rel) => {
                  const relName = parseServerName(rel.name).displayName;
                  return (
                  <div
                    key={rel.id}
                    className="surface-interactive"
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
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
                  <Link
                    href={`/mcp/${rel.id}`}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      flex: 1,
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
                  <Link
                    href={`/mcp/${server.id}/vs/${rel.id}`}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#00E5FF',
                      textDecoration: 'none',
                      paddingTop: '0.35rem',
                      borderTop: '1px solid var(--border-color)',
                    }}
                  >
                    Compare vs {relName} →
                  </Link>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Query-Forward AEO / FAQ Block */}
          <div className="surface" style={{ padding: '1.75rem', marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
              Frequently Asked Questions about {displayName}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                  What is the {displayName} MCP server used for?
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                  {server.description}
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                  How do I install {displayName} in Claude Desktop or Cursor?
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                  Copy the client configuration JSON snippet from the installation section above into your <code>claude_desktop_config.json</code> or <code>.cursor/mcp.json</code> file, then restart your AI application.
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                  Is the {displayName} MCP server free and safe to use?
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                  Yes, {displayName} is listed as a free Model Context Protocol server. Always review repository source code and permissions before granting local workspace access to AI agents.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar (Right Column) */}
        <div className="detail-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* At a Glance Technical Summary Card */}
          <div className="surface" style={{ padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Terminal size={18} style={{ color: 'var(--brand-cyan)' }} />
              <span>At a Glance</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Transport</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {server.installKind === 'remote' || (server.url && !server.url.includes('github.com') && !server.url.includes('gitlab.com')) ? 'SSE (Remote)' : 'STDIO'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Runtime</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {(() => {
                    const cmd = (server.installCommand || '').toLowerCase();
                    const desc = (server.description || '').toLowerCase();
                    if (cmd.includes('uvx') || cmd.includes('python') || cmd.includes('pip') || desc.includes('python')) return 'Python';
                    if (cmd.includes('docker') || desc.includes('docker')) return 'Docker';
                    if (cmd.includes('go') || desc.includes('golang')) return 'Go';
                    return 'Node.js';
                  })()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Health Check</span>
                <span style={{ fontWeight: 600, color: healthUi.color, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: healthUi.color, display: 'inline-block' }} />
                  {healthKey === 'active' ? 'Active' : healthKey === 'down' ? 'Issues' : 'Unknown'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Category</span>
                <Link href={`/browse?category=${encodeURIComponent(server.category)}`} style={{ color: catMeta.color, textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span aria-hidden="true">{catMeta.emoji}</span>
                  <span>{catMeta.label}</span>
                </Link>
              </div>
            </div>
          </div>

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

          {/* Quality grade — transparent, from public signals. */}
          <QualityBadge server={server} />

          {/* Popularity signals (shown when measured). */}
          {(typeof server.githubStars === 'number' || typeof server.npmDownloads === 'number') && (
            <div className="surface" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Popularity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {typeof server.githubStars === 'number' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
                    <Star size={18} style={{ color: '#f5c518' }} />
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{server.githubStars.toLocaleString()}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>GitHub stars</span>
                  </div>
                )}
                {typeof server.npmDownloads === 'number' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
                    <Download size={18} style={{ color: 'var(--accent-color)' }} />
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{server.npmDownloads.toLocaleString()}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>npm downloads / mo</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!server.isOfficial ? (
            <div className="surface" style={{ padding: '1.5rem', borderColor: 'rgba(0,229,255,0.35)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <BadgeCheck size={18} color="var(--accent-color)" /> Own this project?
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.55 }}>
                This directory is pre-filled from public sources. Claim via GitHub README, site badge, or DNS TXT to get the verified badge
                {server.websiteUrl ? '' : ' and attach your website'}.
              </p>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1rem',
                  lineHeight: 1.5,
                  padding: '0.65rem 0.75rem',
                  borderRadius: 8,
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}
              >
                <strong style={{ color: '#34d399' }}>Free dofollow backlink:</strong> after claiming,
                verify your product site and place a dofollow AllMCPs badge — we recheck it stays live.
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
                <Sparkles size={16} /> Claim &amp; get free dofollow
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

          {/* Internal SEO mesh — category, best-of, install guides, alternatives */}
          {(() => {
            const catSlug = categorySlug(server.category);
            const best = bestTopicForCategory(server.category);
            return (
              <div className="surface" style={{ padding: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '1rem',
                    marginBottom: '0.75rem',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Explore more
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Link
                    href={`/categories/${catSlug}`}
                    style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600 }}
                  >
                    More in {server.category} →
                  </Link>
                  {best && (
                    <Link
                      href={`/best/${best.slug}`}
                      style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600 }}
                    >
                      Best MCP servers for {best.title} →
                    </Link>
                  )}
                  <Link
                    href={`/mcp/${server.id}/alternatives`}
                    style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600 }}
                  >
                    Alternatives to {displayName} →
                  </Link>
                  <Link
                    href="/clients/claude-desktop"
                    style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                  >
                    Install in Claude Desktop
                  </Link>
                  <Link
                    href="/clients/cursor"
                    style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                  >
                    Install in Cursor
                  </Link>
                  <Link
                    href="/clients/vs-code"
                    style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                  >
                    Install in VS Code
                  </Link>
                </div>
              </div>
            );
          })()}
          
        </div>
      </div>
    </main>
    </>
  );
}
