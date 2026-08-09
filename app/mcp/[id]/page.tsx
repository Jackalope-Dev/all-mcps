import { FolderGit2, Globe, Terminal, ChevronRight, BadgeCheck, Sparkles, Crown, Star, Download, Wrench, ExternalLink, LifeBuoy, Clock, Info } from 'lucide-react';
import { formatCommitAge, formatFullDate } from '../../../lib/format';
import { parseArgsJson } from '../../../lib/installConfig';
import {
  AUTH_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
  PRICING_MODEL_LABELS,
  type AuthType,
  type MaintenanceStatus,
  type PricingModel,
} from '@/lib/serverEnums';
import { MCP_CLIENTS } from '@/lib/clients';
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
import { repoLinkRel, websiteLinkRel, supportLinkRel } from '../../../lib/linkRel';
import { PremiumUpgrade } from '../../../components/PremiumUpgrade';
import { isFeaturedListing, isVerifiedListing } from '../../../lib/featuredStatus';
import { OutboundLink } from '../../../components/ui/OutboundLink';
import { getRelatedServers, getFeaturedServers, getServerById, getStdioPilotResult, type Server } from '../../../lib/servers';
import { auth } from '../../../lib/auth';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { IconTooltip } from '../../../components/ui/IconTooltip';
import { parseServerName } from '../../../lib/displayName';
import { ImpressionBeacon } from '../../../components/ImpressionTracker';
import { bestTopicForCategory } from '../../../lib/bestTopics';
import { categorySlug, getCategoryMeta } from '../../../lib/categories';
import { ToolSchemaInspector } from '../../../components/ui/ToolSchemaInspector';
import { CollapsibleText } from '../../../components/CollapsibleText';
import { MobileInstallBar } from '../../../components/MobileInstallBar';
import { ScreenshotViewer } from '../../../components/ui/ScreenshotViewer';
import { FaqSection } from '../../../components/ui/FaqSection';
import { FlagshipHeroBanner } from '../../../components/ui/FlagshipHeroBanner';
import { DirectoryBadgeCard } from '../../../components/ui/DirectoryBadgeCard';

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

// Keeps the rendered <title> (this string + the root layout's " | AllMCPs" suffix)
// within ~60 chars even for the longest real listing names, which can run 40+
// chars once the org/scope prefix is stripped off by parseServerName.
function buildDetailTitle(displayName: string): string {
  const suffix = /mcp\s*server$/i.test(displayName) ? '' : ' MCP Server';
  const budget = 50 - suffix.length;
  if (displayName.length <= budget) return `${displayName}${suffix}`;
  const truncated = displayName.slice(0, Math.max(10, budget - 1)).trimEnd();
  return `${truncated}…${suffix}`;
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

  const { displayName } = parseServerName(server.name);
  const title = buildDetailTitle(displayName);

  return {
    title,
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
      title: `${title} | AllMCPs`,
      description: desc,
      url: `https://allmcps.com/mcp/${server.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AllMCPs`,
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
  const rawPilotResult = await getStdioPilotResult(server.id);
  // A pilot check is only meaningful for the install command it actually
  // tested. install_extracted_at (LLM re-validation) can rewrite that
  // command after the pilot ran — stale otherwise, showing a mismatched
  // command/error pairing that never actually happened together.
  const pilotResult =
    rawPilotResult &&
    (!server.installExtractedAt ||
      new Date(rawPilotResult.checkedAt).getTime() >= new Date(server.installExtractedAt).getTime())
      ? rawPilotResult
      : null;
  // Live tools/list handshake (health cron) already confirmed the server itself
  // works — used to soften the "not yet checked" install-sandbox message below
  // so it doesn't contradict the verified badge shown elsewhere on the page.
  const hasIntrospectedTools = server.toolsSource === 'introspected';
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

  // Real, listing-specific FAQ once the ai-content/ai-faq pipeline has reached
  // this row; falls back to generic-but-accurate boilerplate until then, so the
  // FAQPage schema and the visible section are never empty. Mirrors the
  // fail-soft pattern already used for aiOverview/aiUseCases/aiFeatures above.
  const faqItems: { q: string; a: string }[] =
    server.aiFaq && server.aiFaq.length > 0
      ? server.aiFaq
      : [
          {
            q: `How do I install the ${server.name} MCP server?`,
            a: `Add the following block to your claude_desktop_config.json under mcpServers: "mcpServers": { "${installSlug}": { "command": "npx", "args": ["-y", "${server.name}"] } }`,
          },
          { q: `What does ${server.name} do?`, a: server.description },
          {
            q: `Is the ${server.name} MCP server free to use?`,
            a: `Yes. ${server.name} is listed on AllMCPs as a free, open Model Context Protocol server you can install into Claude Desktop, Cursor, or any MCP-compatible client.`,
          },
        ];

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
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
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
          <li className="breadcrumb-separator" aria-hidden="true"><ChevronRight size={12} aria-hidden="true" /></li>
          <li><Link href={`/browse?category=${encodeURIComponent(server.category)}`}>{server.category}</Link></li>
          <li className="breadcrumb-separator" aria-hidden="true"><ChevronRight size={12} aria-hidden="true" /></li>
          <li className="breadcrumb-current" aria-current="page">{displayName}</li>
        </ol>
      </nav>

      <div className="detail-grid">

        {/* Main Content (Left Column) */}
        <div className="detail-main">
          <div className="detail-title-row">
            {/* Prefer approved R2 logo, else GitHub org avatar, else category gradient (ServerAvatar). */}
            <ServerAvatar
              name={server.name}
              logoUrl={server.logoUrl}
              category={server.category}
              size={72}
            />
            <div className="detail-title-text">
              <div className="detail-title-heading">
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
                <h1 className="text-page-title detail-page-title">
                  <span className="detail-page-name">{displayName}</span>
                </h1>
              </div>
              <div className="detail-title-badges">
                {server.isPremium && (
                  <IconTooltip
                    label="Premium listing"
                    trigger={
                      <Badge className="mcp-trust-badge mcp-trust-badge--premium">
                        <Crown size={13} color="#d97706" fill="#d97706" />
                        <span className="mcp-trust-badge-label">Premium</span>
                      </Badge>
                    }
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
                    trigger={
                      <Badge variant="official" className="mcp-trust-badge">
                        <BadgeCheck size={13} />
                        <span className="mcp-trust-badge-label">{server.isOfficial ? 'Verified' : 'Premium'}</span>
                      </Badge>
                    }
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
                {isFeaturedListing(server) && (
                  <IconTooltip
                    label="Featured listing"
                    trigger={
                      <Badge variant="success" className="badge-featured mcp-trust-badge">
                        <Star size={13} color="var(--accent-color)" fill="var(--accent-color)" />
                        <span className="mcp-trust-badge-label">Featured</span>
                      </Badge>
                    }
                  >
                    <span className="mcp-icon-tooltip-title">
                      <Star size={14} color="var(--accent-color)" fill="var(--accent-color)" /> Featured listing
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      {server.isPremium
                        ? 'Included with this listing’s active Premium subscription — boosted placement across search, category pages, and homepage spotlight rotation.'
                        : 'Currently boosted for extra visibility — priority placement across search, category pages, and homepage spotlight rotation.'}
                    </span>
                  </IconTooltip>
                )}
              </div>
            </div>
          </div>

          {/* Primary actions: Upvote, Repository, Website, Share & Embed */}
          <div className="mcp-header-toolbar">
            <UpvoteButton serverId={server.id} initialCount={server.upvotes || 0} />

            <OutboundLink
              href={server.url}
              destinationType="github"
              serverId={server.id}
              target="_blank"
              rel={repoLinkRel(!!server.isPremium, !!server.isOfficial)}
              className="mcp-action-btn"
            >
              <FolderGit2 size={18} style={{ color: 'var(--accent-color)' }} />
              <span className="mcp-action-btn-label">View Repository</span>
              {server.isOfficial && (
                <BadgeCheck size={16} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
              )}
              {typeof server.githubStars === 'number' && server.githubStars > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(234, 179, 8, 0.12)',
                    color: '#d97706',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    marginLeft: '0.2rem',
                    lineHeight: 1,
                  }}
                >
                  <Star size={12} fill="#d97706" color="#d97706" />
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
                className="mcp-action-btn mcp-action-btn--accent"
              >
                <Globe size={18} style={{ color: 'var(--accent-color)' }} />
                <span className="mcp-action-btn-label">Visit Website</span>
                {server.websiteVerified ? (
                  <BadgeCheck size={16} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                ) : (
                  <ExternalLink size={14} style={{ opacity: 0.85 }} />
                )}
              </OutboundLink>
            )}

            {server.supportUrl && (
              <OutboundLink
                href={server.supportUrl}
                destinationType="website"
                serverId={server.id}
                target="_blank"
                rel={supportLinkRel(!!server.isPremium, !!server.reciprocalBadgeOk, server.supportUrl, server.websiteUrl)}
                className="mcp-action-btn"
              >
                <LifeBuoy size={18} style={{ color: 'var(--accent-color)' }} />
                <span className="mcp-action-btn-label">Support</span>
              </OutboundLink>
            )}

            <ShareModal serverId={server.id} serverName={server.name} variant="action" />
          </div>

          {server.tags && server.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
              {server.tags.map((tag) => (
                <Badge key={tag} variant="category" style={{ fontSize: '0.72rem' }}>
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {server.screenshotUrl && (
            <ScreenshotViewer
              src={server.screenshotUrl}
              alt={`${displayName} screenshot`}
              title={`${displayName} Screenshot`}
            />
          )}

          {server.id === 'allmcps-server' && (
            <FlagshipHeroBanner serverId={server.id} serverName={displayName} />
          )}

          <div className="detail-summary" style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
            <SafeMarkdown content={(server.aiSummary && server.aiSummary.trim()) || server.description} utmContent={server.id} repoUrl={server.url} />
          </div>

          {/* Install-first: primary conversion path sits above long AI copy / README. */}
          <section id="quick-install" className="surface detail-quick-install" style={{ marginBottom: '1.75rem', scrollMarginTop: '5rem', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--brand-gradient-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                <Terminal size={20} style={{ color: 'var(--accent-color)', flexShrink: 0 }} aria-hidden="true" /> Quick Install
              </h2>
              <Badge variant="success" style={{ fontSize: '0.75rem' }}>
                Automated &amp; IDE Setup
              </Badge>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.25rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
              Copy the AI prompt to install this server into Claude Code, Cursor, or another agent — or use 1-click editor setup below.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <AgentPromptButton serverId={server.id} serverName={server.name} />
            </div>

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
              suggestedInstallCommand={server.suggestedInstallCommand}
              suggestedInstallArgs={server.suggestedInstallArgs}
            />

            {server.remoteEndpointUrl && (
              <div
                style={{
                  marginTop: '1.25rem',
                  borderRadius: '10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  padding: '0.85rem 1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  <Globe size={14} style={{ color: 'var(--accent-color)' }} /> Also available as a hosted endpoint
                  {server.remoteEndpointHealthy != null && (
                    <span
                      title={
                        formatFullDate(server.remoteEndpointCheckedAt)
                          ? `Last checked ${formatFullDate(server.remoteEndpointCheckedAt)}`
                          : undefined
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: server.remoteEndpointHealthy ? '#34d399' : '#f87171',
                        marginLeft: '0.2rem',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: server.remoteEndpointHealthy ? '#34d399' : '#f87171',
                        }}
                      />
                      {server.remoteEndpointHealthy ? 'Live' : 'Unreachable'}
                      {formatCommitAge(server.remoteEndpointCheckedAt) ? ` · ${formatCommitAge(server.remoteEndpointCheckedAt)}` : ''}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 0.6rem' }}>
                  Clients with native remote MCP support can connect directly to this URL instead of the {server.installKind === 'stdio' ? 'stdio install' : 'install method'} above.
                </p>
                <CopyBlock
                  code={server.remoteEndpointUrl}
                  serverId={server.id}
                  title="Remote endpoint"
                  language="text"
                  snippetType="remote_endpoint_url"
                />
              </div>
            )}

            {pilotResult && (
              <div
                style={{
                  marginTop: '1.25rem',
                  borderRadius: '10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  padding: '0.85rem 1rem',
                }}
              >
                {pilotResult.status === 'ok' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    <Sparkles size={14} style={{ color: '#34d399' }} /> Automated check passed
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.8rem' }}>
                      — started and listed {pilotResult.toolCount ?? 'its'} tools correctly
                      {formatCommitAge(pilotResult.checkedAt) ? ` (${formatCommitAge(pilotResult.checkedAt)})` : ''}.
                    </span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      <Info size={14} style={{ color: 'var(--accent-color)' }} /> We couldn&rsquo;t automatically confirm this listing starts correctly
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 0.6rem' }}>
                      {
                        {
                          timeout: "We ran the install command below but it didn't respond within our test window — this can mean a slow first-time install rather than a real problem.",
                          handshake_failed: "The install command below started, but didn't respond the way we expected when we tried to talk to it.",
                          install_failed: "The install command below didn't complete successfully in our automated test.",
                          error: 'We hit an unexpected error while testing this listing automatically.',
                        }[pilotResult.status]
                      }
                    </p>
                    <code
                      style={{
                        display: 'block',
                        fontSize: '0.78rem',
                        padding: '0.5rem 0.7rem',
                        borderRadius: '6px',
                        background: 'var(--bg-muted)',
                        border: '1px solid var(--border-color)',
                        marginBottom: pilotResult.error ? '0.5rem' : 0,
                        wordBreak: 'break-word',
                      }}
                    >
                      {[server.installCommand, ...(parseArgsJson(server.installArgs) ?? [])].filter(Boolean).join(' ')}
                    </code>
                    {pilotResult.error && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'monospace', margin: '0 0 0.6rem', wordBreak: 'break-word' }}>
                        {pilotResult.error}
                      </p>
                    )}
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>
                      This is an experimental automated check and can have false negatives — missing environment variables, a slow cold install, etc.
                      It doesn&rsquo;t necessarily mean something&rsquo;s wrong.
                      {formatCommitAge(pilotResult.checkedAt) ? ` Last checked ${formatCommitAge(pilotResult.checkedAt)}.` : ''}{' '}
                      {!isOwner && !server.isOfficial && (
                        <Link href={`/mcp/${server.id}/claim`} style={{ color: 'var(--accent-color)' }}>
                          Own this listing? Claim it to help us verify it.
                        </Link>
                      )}
                    </p>
                  </>
                )}
              </div>
            )}

            <details className="detail-manual-config" style={{ marginTop: '1.25rem', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '0.75rem 1rem' }}>
              <summary className="detail-manual-config-summary">
                <span>Manual Client &amp; Custom JSON Config</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.7, flexShrink: 0 }}>Expand JSON ▾</span>
              </summary>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', minWidth: 0 }}>
                <ClientConfigTabs server={server} />
              </div>
            </details>
          </section>

          {/* Next steps strip — install → claim → compare */}
          <nav className="detail-next-steps" aria-label="Next steps">
            <a href="#quick-install" className="detail-next-step">
              <Terminal size={14} aria-hidden="true" /> Install
            </a>
            {server.tools && server.tools.length > 0 && (
              <a href="#tools-schema" className="detail-next-step">
                <Wrench size={14} aria-hidden="true" /> Tool Schemas ({server.tools.length})
              </a>
            )}
            <a href="#directory-badge" className="detail-next-step">
              <BadgeCheck size={14} aria-hidden="true" /> Directory Badge
            </a>
            {!server.isOfficial && (
              <Link href={`/mcp/${server.id}/claim`} className="detail-next-step">
                <BadgeCheck size={14} aria-hidden="true" /> Claim listing
              </Link>
            )}
            <Link href={`/mcp/${server.id}/alternatives`} className="detail-next-step">
              <Sparkles size={14} aria-hidden="true" /> Alternatives
            </Link>
            <Link href={`/browse?category=${encodeURIComponent(server.category)}`} className="detail-next-step">
              <span aria-hidden="true">{catMeta.emoji}</span> More in {catMeta.label}
            </Link>
          </nav>

          {/* AI-authored content — overview soft-collapsed so install stays primary. */}
          {(server.aiOverview ||
            (server.aiUseCases?.length ?? 0) > 0 ||
            (server.aiFeatures?.length ?? 0) > 0) && (
            <section style={{ marginBottom: '2.5rem' }}>
              {server.aiOverview && (
                <>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={20} style={{ color: 'var(--accent-color)' }} aria-hidden="true" /> Overview
                  </h2>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '1rem', margin: '0 0 1.5rem' }}>
                    <CollapsibleText collapsedLines={4}>
                      <p style={{ margin: 0 }}>{server.aiOverview}</p>
                    </CollapsibleText>
                  </div>
                </>
              )}
              <div className="detail-ai-grid">
                {(server.aiUseCases?.length ?? 0) > 0 && (
                  <div className="surface" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                      <Sparkles size={16} style={{ color: 'var(--accent-color)' }} aria-hidden="true" /> Use cases
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {server.aiUseCases!.map((uc) => (
                        <div key={uc} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1rem', lineHeight: '1', marginTop: '-1px' }} aria-hidden="true">•</span>
                          <span>{uc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(server.aiFeatures?.length ?? 0) > 0 && (
                  <div className="surface" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                      <Wrench size={16} style={{ color: 'var(--accent-color)' }} aria-hidden="true" /> Key features
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {server.aiFeatures!.map((f) => (
                        <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1rem', lineHeight: '1', marginTop: '-1px' }} aria-hidden="true">•</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section id="tools-schema" style={{ scrollMarginTop: '5rem' }}>
            <ToolSchemaInspector
              tools={server.tools}
              aiFeatures={server.aiFeatures}
              aiUseCases={server.aiUseCases}
              serverName={displayName}
              toolsSource={server.toolsSource}
            />
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Documentation Overview</h2>
            <div className="detail-readme-scroll">
              <div className="markdown-body">
                {readme ? (
                  <SafeMarkdown content={readme} utmContent={server.id} repoUrl={server.url} />
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
          </section>

          {/* Related MCP Servers */}
          {relatedServers && relatedServers.length > 0 && (
            <section style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> Related MCP Servers
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link
                    href={`/categories/${categorySlug(server.category)}`}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                  >
                    View all in {catMeta.label} <ChevronRight size={14} />
                  </Link>
                  <Link
                    href={`/mcp/${server.id}/alternatives`}
                    style={{ fontSize: '0.85rem', color: 'var(--accent-color)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                  >
                    View all alternatives <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
              <ul className="detail-related-grid">
                {relatedServers.map((rel) => {
                  const relName = parseServerName(rel.name).displayName;
                  return (
                  <li
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
                        <ServerAvatar name={rel.name} logoUrl={rel.logoUrl} category={rel.category} size={32} />
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {relName}
                        </span>
                      </div>
                      {isFeaturedListing(rel as any) ? (
                        <Badge variant="success" className="badge-featured" style={{ fontSize: '0.65rem', flexShrink: 0 }}>
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
                      color: 'var(--accent-color)',
                      textDecoration: 'none',
                      paddingTop: '0.35rem',
                      borderTop: '1px solid var(--border-color)',
                    }}
                  >
                    Compare vs {relName} →
                  </Link>
                  </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Query-Forward AEO / FAQ Block */}
          <section style={{ marginTop: '2.5rem' }}>
            <FaqSection
              title={`Frequently Asked Questions about ${displayName}`}
              items={faqItems.map((item) => ({ question: item.q, answer: item.a }))}
            />
          </section>

          {/* Directory Badge Generator Card - Bottom of Page */}
          <div style={{ marginTop: '2.5rem' }}>
            <DirectoryBadgeCard serverId={server.id} serverName={displayName} />
          </div>
        </div>

        <MobileInstallBar displayName={displayName} />

        {/* Sidebar (Right Column) */}
        <div className="detail-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Technical Specs, Popularity & Quality Summary Card */}
          <div className="surface detail-specs-card" style={{ padding: '1.35rem', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Terminal size={18} style={{ color: 'var(--brand-cyan)', flexShrink: 0 }} />
              <span>Technical Specs &amp; Signals</span>
            </h3>

            {/* Category/pricing stay top-level — everything else is one click away below. */}
            <div className="detail-spec-list" style={{ fontSize: '0.85rem', minWidth: 0 }}>
              <div className="detail-spec-row">
                <span style={{ color: 'var(--text-secondary)' }}>Category</span>
                <Link href={`/browse?category=${encodeURIComponent(server.category)}`} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textAlign: 'right', minWidth: 0 }}>
                  <span aria-hidden="true">{catMeta.emoji}</span>
                  <span style={{ overflowWrap: 'anywhere' }}>{catMeta.label}</span>
                </Link>
              </div>
              {server.pricingModel && (
                <div className="detail-spec-row">
                  <span style={{ color: 'var(--text-secondary)' }}>Pricing</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
                    {PRICING_MODEL_LABELS[server.pricingModel as PricingModel] || server.pricingModel}
                    {server.pricingNotes ? (
                      <span style={{ display: 'block', fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {server.pricingNotes}
                      </span>
                    ) : null}
                  </span>
                </div>
              )}
            </div>

            {/* Less decision-relevant metadata, collapsed by default — health is
                already shown by the dot next to the listing name up top. */}
            <details className="detail-sidebar-more">
              <summary className="detail-manual-config-summary">
                <span>More technical details</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.7, flexShrink: 0 }}>Expand ▾</span>
              </summary>
              <div className="detail-spec-list" style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <div className="detail-spec-row">
                  <span style={{ color: 'var(--text-secondary)' }}>Transport</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
                    {server.installKind === 'remote' || (server.url && !server.url.includes('github.com') && !server.url.includes('gitlab.com')) ? 'SSE (Remote)' : 'STDIO'}
                  </span>
                </div>
                <div className="detail-spec-row">
                  <span style={{ color: 'var(--text-secondary)' }}>Runtime</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
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
                {server.authType && (
                  <div className="detail-spec-row">
                    <span style={{ color: 'var(--text-secondary)' }}>Auth</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
                      {AUTH_TYPE_LABELS[server.authType as AuthType] || server.authType}
                    </span>
                  </div>
                )}
                {server.license && (
                  <div className="detail-spec-row">
                    <span style={{ color: 'var(--text-secondary)' }}>License</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>{server.license}</span>
                  </div>
                )}
                {server.maintenanceStatus && (
                  <div className="detail-spec-row">
                    <span style={{ color: 'var(--text-secondary)' }}>Maintenance</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
                      {MAINTENANCE_STATUS_LABELS[server.maintenanceStatus as MaintenanceStatus] ||
                        server.maintenanceStatus}
                    </span>
                  </div>
                )}
                {server.compatibleClients && server.compatibleClients.length > 0 && (
                  <div className="detail-spec-row">
                    <span style={{ color: 'var(--text-secondary)' }}>Clients</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
                      {server.compatibleClients
                        .map((slug) => MCP_CLIENTS.find((c) => c.slug === slug)?.name || slug)
                        .join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </details>

            {/* Popularity signals — 2-up grid reads faster and takes less vertical space than one full-width row each. */}
            <div className="detail-stats-grid">
              <ViewTracker serverId={server.id} initialCount={server.views || 0} />
              <InstallsStat count={server.copies || 0} />
              {typeof server.githubStars === 'number' && (
                <div className="detail-stat-item">
                  <span className="detail-stat-item-label">
                    <Star size={12} style={{ color: '#f5c518' }} /> GitHub stars
                  </span>
                  <span className="detail-stat-item-value">{server.githubStars.toLocaleString()}</span>
                </div>
              )}
              {formatCommitAge(server.lastCommitAt) && (
                <div
                  className="detail-stat-item"
                  title={
                    formatFullDate(server.lastCommitAt)
                      ? `Last commit on ${formatFullDate(server.lastCommitAt)}`
                      : 'Last time this repo was pushed to, from the GitHub API'
                  }
                >
                  <span className="detail-stat-item-label">
                    <Clock size={12} style={{ color: 'var(--accent-color)' }} /> Last commit
                  </span>
                  <span className="detail-stat-item-value">{formatCommitAge(server.lastCommitAt)}</span>
                </div>
              )}
              {typeof server.npmDownloads === 'number' && (
                <div className="detail-stat-item">
                  <span className="detail-stat-item-label">
                    <Download size={12} style={{ color: 'var(--accent-color)' }} /> npm downloads
                  </span>
                  <span className="detail-stat-item-value">{server.npmDownloads.toLocaleString()}/mo</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <QualityBadge server={server} />
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
                      borderRadius: '16px',
                      border: '1px solid var(--accent-color)',
                      background: 'var(--surface-highlight)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <Badge variant="success" className="badge-featured" style={{ fontSize: '0.7rem' }}>
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
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      <SafeMarkdown content={spotlightPick.description || 'No description provided.'} isInline />
                    </p>
                    <Link
                      href={`/mcp/${spotlightPick.id}`}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Explore Server →
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
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                background: 'var(--brand-gradient-soft)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <Badge variant="success" className="badge-featured" style={{ fontSize: '0.7rem' }}>
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
                  background: 'var(--brand-gradient)',
                  color: '#ffffff',
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
                <strong style={{ color: 'var(--verified-green)' }}>Free dofollow backlink:</strong> after claiming,
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
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: dofollow ? 'var(--verified-green)' : 'var(--text-secondary)', marginBottom: dofollow ? 0 : '0.5rem' }}>
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

          {isOwner && server.status === 'active' && (
            <PremiumUpgrade
              serverId={server.id}
              listingStatus={server.status}
              isPremium={!!server.isPremium}
              featuredUntil={server.featuredUntil}
              categorySponsorUntil={server.categorySponsorUntil}
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
