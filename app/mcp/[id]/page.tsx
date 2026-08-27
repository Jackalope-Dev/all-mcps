import { FolderGit2, Globe, Terminal, ChevronRight, BadgeCheck, Sparkles, Crown, Star, Download, Wrench, ExternalLink, LifeBuoy, Clock, Info, CheckCircle, AlertTriangle } from 'lucide-react';
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
import { repoLinkRel, websiteLinkRel, supportLinkRel } from '../../../lib/linkRel';
import { OwnerZone } from '../../../components/ui/OwnerZone';
import { ReportListingButton } from '../../../components/ui/ReportListingButton';
import { VulnSignalCard } from '../../../components/ui/VulnSignalCard';
import { ClaimHintLink } from '../../../components/ui/ClaimHintLink';
import { isFeaturedListing, isVerifiedListing } from '../../../lib/featuredStatus';
import { OutboundLink } from '../../../components/ui/OutboundLink';
import { getRelatedServers, getFeaturedServers, getServerById, getStdioPilotResult, getServerHealthHistory, getServerReviews, computeCombinedAvailabilityPct, truncateReadmeExcerpt, type Server } from '../../../lib/servers';
import { ReviewsSection } from '../../../components/ui/ReviewsSection';
import { HealthHistoryStrip } from '../../../components/ui/HealthHistoryStrip';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { IconTooltip } from '../../../components/ui/IconTooltip';
import { parseServerName } from '../../../lib/displayName';
import { ImpressionBeacon } from '../../../components/ImpressionTracker';
import { SponsorAdUnit } from '../../../components/ads/SponsorAdUnit';
import { bestTopicForCategory } from '../../../lib/bestTopics';
import { categorySlug, getCategoryMeta } from '../../../lib/categories';
import { ToolSchemaInspector } from '../../../components/ui/ToolSchemaInspector';
import { CollapsibleText } from '../../../components/CollapsibleText';
import { MobileInstallBar } from '../../../components/MobileInstallBar';
import { ScreenshotViewer } from '../../../components/ui/ScreenshotViewer';
import { FaqSection } from '../../../components/ui/FaqSection';
import { FlagshipHeroBanner } from '../../../components/ui/FlagshipHeroBanner';
import { DirectoryBadgeCard } from '../../../components/ui/DirectoryBadgeCard';
import { AdminQuickBar } from '../../../components/ui/AdminQuickBar';

// Listing shape and the D1-with-JSON-fallback fetch (incl. README-chrome
// sanitization) live in lib/servers so every page/route stays consistent.
const getServer = getServerById;

// Keeps the rendered <title> (this string + the root layout's " | AllMCPs" suffix)
// within ~60 chars while aligning with developer search intent (config, tools, setup).
function buildDetailTitle(displayName: string): string {
  const base = displayName.trim();
  const cleanName = /mcp/i.test(base) ? base : `${base} MCP`;
  const candidate = `${cleanName}: Config & Tools`;
  if (candidate.length <= 48) return candidate;
  const shortCandidate = `${cleanName} Server`;
  if (shortCandidate.length <= 48) return shortCandidate;
  return cleanName.slice(0, 45).trimEnd();
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
  const metaSource = (server.aiSummary && server.aiSummary.trim()) || server.description || '';
  let cleanSource = metaSource.trim().replace(/\.+$/, '');
  if (cleanSource.length > 100) {
    cleanSource = `${cleanSource.slice(0, 97).trimEnd()}...`;
  }
  let desc = `${cleanSource}. Install & connect to Claude Desktop, Cursor & Windsurf with verified JSON config & tools.`;
  if (desc.length > 160) {
    desc = `${desc.slice(0, 157).trimEnd()}...`;
  }

  const { displayName } = parseServerName(server.name, server.url);
  const title = buildDetailTitle(displayName);

  // Quality gate: a listing with no AI enrichment, no introspected/parsed tools,
  // a thin description, AND no fetchable README has nothing unique for Google to
  // index — such pages just sit in "Crawled - currently not indexed" and dilute
  // sitewide quality signals. noindex (follow) them until the enrichment pipeline
  // gives them real content; aiEnrichedAt/aiSummary then flips them back to
  // indexable automatically, so this self-heals and never permanently buries a
  // listing. The README probe (the one network call) runs ONLY for the already-
  // barren minority — the cheap stored signals short-circuit everyone else — and
  // reuses fetchReadme's cache, shared with the page render below.
  const hasEnrichment =
    Boolean(server.aiEnrichedAt) ||
    Boolean(server.aiSummary && server.aiSummary.trim()) ||
    Boolean(server.aiOverview && server.aiOverview.trim()) ||
    (Array.isArray(server.tools) && server.tools.length > 0);
  const hasSubstantialDescription = (server.description ?? '').trim().length >= 120;
  // Real-world popularity is its own proof a listing matters — never noindex one
  // just because its content fields happen to be empty (e.g. a transient README
  // fetch miss). Belt-and-suspenders against over-gating.
  const hasTraction = (server.githubStars ?? 0) >= 25 || (server.npmDownloads ?? 0) >= 100;
  let isThinListing = false;
  if (
    !hasEnrichment &&
    !hasTraction &&
    !hasSubstantialDescription &&
    server.status !== 'removed'
  ) {
    const probeReadme = await fetchReadme(server.url).catch(() => null);
    isThinListing = !(probeReadme && probeReadme.trim().length >= 200);
  }

  const robotsOverride =
    server.status === 'removed'
      ? { robots: { index: false, follow: false } as const }
      : isThinListing
        ? { robots: { index: false, follow: true } as const }
        : {};

  return {
    title,
    description: desc,
    keywords: [server.name, 'MCP server', 'Model Context Protocol', 'AI agent tool', server.category].join(', '),
    // Auto-unpublished (dead/archived source) → noindex,nofollow (removed);
    // barren stub with no unique content → noindex,follow (thin, self-heals on
    // enrichment); everything else indexes normally. See robotsOverride above.
    ...robotsOverride,
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
      const text = await res.text();
      return text.length > 250000 ? `${text.slice(0, 250000)}\n\n*(README truncated for size)*` : text;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Now safe to mark ISR (no server-side session read left in this page — see
// OwnerZone/ClaimHintLink, which fetch ownership client-side instead). Pages
// beyond the 50 covered by generateStaticParams below persist cross-request
// via the R2-backed incrementalCache configured in open-next.config.ts.
export const revalidate = 3600;

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
    // Serve a genuine HTTP 404 (via app/not-found.tsx) instead of a 200 page with a
    // "not found" body — the latter is a soft 404 that wastes crawl budget and can get
    // an empty URL indexed.
    notFound();
  }

  // Independent I/O (external README fetch, two category/featured lookups, a pilot-check
  // query) — run concurrently instead of one big sequential waterfall.
  // getRelatedServers and getFeaturedServers use targeted D1 category/featured queries
  // (see lib/servers.ts) to keep memory footprint < 2MB.
  // Deliberately no session/auth() read here — that would force this page dynamic
  // (uncacheable) on every request. Ownership-gated UI (OwnerZone, ClaimHintLink)
  // fetches its own status client-side instead so this page can be ISR'd.
  const [readme, relatedServers, rawPilotResult, featuredPool, healthHistory, reviewSummary] = await Promise.all([
    fetchReadme(server.url),
    getRelatedServers(server as any, 4),
    getStdioPilotResult(server.id),
    getFeaturedServers(server.id, 10),
    getServerHealthHistory(server.id),
    getServerReviews(server.id),
  ]);
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
  // Rolling remote-endpoint history combined with a confirmed-fresh pilot
  // pass — see computeCombinedAvailabilityPct in lib/servers.ts for why this
  // takes priority over a single live snapshot in the quality score.
  const combinedAvailabilityPct = computeCombinedAvailabilityPct(healthHistory, pilotResult?.status === 'ok');
  const serverForScoring: Server = {
    ...server,
    ...(combinedAvailabilityPct != null ? { combinedAvailabilityPct } : null),
    reviewCount: reviewSummary.count,
    avgRating: reviewSummary.avgRating,
  };
  // Live tools/list handshake (health cron) already confirmed the server itself
  // works — used to soften the "not yet checked" install-sandbox message below
  // so it doesn't contradict the verified badge shown elsewhere on the page.
  const hasIntrospectedTools = server.toolsSource === 'introspected';
  const { displayName, org } = parseServerName(server.name, server.url);
  const catMeta = getCategoryMeta(server.category);
  const catSlug = categorySlug(server.category);
  const categoryLabel = catMeta.label;

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
  const spotlightCandidates = [...featuredPool, null];
  const spotlightPick = spotlightCandidates[Math.floor(Math.random() * spotlightCandidates.length)];
  // The mcpServers key just needs to be a readable identifier; the npx arg below
  // uses server.name verbatim since that's typically the real package name
  // (e.g. "@agentfund/mcp") and slugifying it would produce a nonexistent package.
  const installSlug = (server.name.split('/').pop() || server.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mcp-server';

  // Whether this listing carries a real, supplied description rather than the
  // insert-time sentinel (submit routes default an omitted description to
  // 'No description provided.'). There's no stored provenance flag distinguishing
  // a submitter-typed description from a scraped GitHub one — both land in the same
  // column — so a substantive, non-sentinel value is the best available signal that
  // the summary above is genuine listing content. When it is, we drop the apologetic
  // "we couldn't pull a README, so this comes from listing details" chrome below.
  const hasSuppliedDescription =
    server.description.trim().length > 0 &&
    server.description.trim() !== 'No description provided.';

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

  const hasRealFaq = Boolean(server.aiFaq && server.aiFaq.length > 0);

  const howToJsonLd = {
    '@type': 'HowTo',
    name: `How to install and connect ${displayName} MCP Server`,
    description: `Step-by-step instructions to configure ${displayName} for Claude Desktop, Cursor, Windsurf, or Cline.`,
    totalTime: 'PT2M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Copy Configuration Snippet',
        text: `Copy the JSON configuration block for ${displayName} formatted for your MCP client.`,
        url: `${canonicalUrl}#config-tabs`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Open Client MCP Settings',
        text: 'Open your MCP client settings file (e.g. claude_desktop_config.json for Claude Desktop, or Cursor Settings > Features > MCP).',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Add Server Configuration',
        text: `Paste the ${installSlug} configuration snippet under the mcpServers key, adding any required environment variables.`,
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Restart Client & Test Tools',
        text: `Restart your AI editor or client and verify that ${displayName} tools are active.`,
      },
    ],
  };

  const jsonLdGraph: any[] = [
    {
      '@type': 'SoftwareApplication',
      name: displayName,
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
      ...(reviewSummary.count > 0 && reviewSummary.avgRating
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: reviewSummary.avgRating.toFixed(1),
              reviewCount: reviewSummary.count,
              bestRating: '5',
              worstRating: '1',
            },
          }
        : {}),
      ...(interactionStatistic.length ? { interactionStatistic } : {}),
    },
    howToJsonLd,
    ...(hasRealFaq
      ? [
          {
            '@type': 'FAQPage',
            mainEntity: server.aiFaq!.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          },
        ]
      : []),
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
          name: categoryLabel,
          item: `https://allmcps.com/categories/${catSlug}`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: server.name,
          item: `https://allmcps.com/mcp/${server.id}`,
        },
      ],
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': jsonLdGraph,
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
          <li><Link href={`/categories/${catSlug}`}>{categoryLabel}</Link></li>
          <li className="breadcrumb-separator" aria-hidden="true"><ChevronRight size={12} aria-hidden="true" /></li>
          <li className="breadcrumb-current" aria-current="page">{displayName}</li>
        </ol>
      </nav>

      {server.status === 'removed' && (
        <div
          role="alert"
          className="surface"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(248, 113, 113, 0.35)',
            background: 'rgba(248, 113, 113, 0.08)',
          }}
        >
          <AlertTriangle size={20} style={{ color: '#f87171', flexShrink: 0, marginTop: '0.1rem' }} aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
              This listing appears offline
            </p>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Our automated checks couldn&rsquo;t reach the source repository, so we&rsquo;ve removed it from
              search, browse, and the API — this page stays reachable at this direct link only.
              {!server.isOfficial && ' If this is your project, claim it to fix the link and restore visibility.'}
            </p>
            {!server.isOfficial && (
              <Link
                href={`/mcp/${server.id}/claim`}
                className="btn btn-secondary"
                style={{ marginTop: '0.75rem', fontSize: '0.85rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <BadgeCheck size={14} /> Claim this listing
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="detail-grid">

        {/* Main Content (Left Column) */}
        <div className="detail-main">
          <div className="surface detail-hero-card">
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
                <a href="#reviews" className="detail-rating-badge-link" style={{ textDecoration: 'none' }}>
                  <IconTooltip
                    label={
                      reviewSummary.count > 0
                        ? `${reviewSummary.avgRating.toFixed(1)} stars out of 5 (${reviewSummary.count} ${reviewSummary.count === 1 ? 'rating' : 'ratings'})`
                        : 'No ratings yet — click to review'
                    }
                    trigger={
                      <span className="mcp-rating-header-badge">
                        <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
                          {[1, 2, 3, 4, 5].map((n) => {
                            const isFilled = reviewSummary.count > 0 && n <= Math.round(reviewSummary.avgRating);
                            return (
                              <Star
                                key={n}
                                size={12}
                                fill={isFilled ? '#fbbf24' : 'none'}
                                color={isFilled ? '#fbbf24' : 'var(--border-strong)'}
                              />
                            );
                          })}
                        </span>
                        {reviewSummary.count > 0 ? (
                          <>
                            <span style={{ fontWeight: 700, marginLeft: '0.15rem' }}>
                              {reviewSummary.avgRating.toFixed(1)}
                            </span>
                            <span style={{ opacity: 0.7, fontSize: '0.76rem', fontWeight: 500 }}>
                              ({reviewSummary.count})
                            </span>
                          </>
                        ) : (
                          <span style={{ opacity: 0.7, fontSize: '0.78rem', fontWeight: 500, marginLeft: '0.15rem' }}>
                            No ratings
                          </span>
                        )}
                      </span>
                    }
                  >
                    <span className="mcp-icon-tooltip-title">
                      <Star size={14} fill="#fbbf24" color="#fbbf24" /> User Ratings
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      {reviewSummary.count > 0
                        ? `Rated ${reviewSummary.avgRating.toFixed(1)} / 5.0 across ${reviewSummary.count} user ${reviewSummary.count === 1 ? 'review' : 'reviews'}. Click to view or leave a rating.`
                        : 'Be the first to rate and review this MCP server!'}
                    </span>
                  </IconTooltip>
                </a>
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
                {!server.aiEnrichedAt && (
                  <IconTooltip
                    label="Enrichment pending"
                    trigger={
                      <Badge variant="default" className="mcp-trust-badge">
                        <Clock size={13} />
                        <span className="mcp-trust-badge-label">Pending</span>
                      </Badge>
                    }
                  >
                    <span className="mcp-icon-tooltip-title">
                      <Clock size={14} style={{ color: 'var(--text-secondary)' }} /> Enrichment pending
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      We haven&rsquo;t run our AI enrichment pass on this listing yet, so the overview, use
                      cases, and FAQ below may be sparse or missing. We work through the catalog over
                      time — check back soon.
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
                <IconTooltip
                  label={`${server.githubStars.toLocaleString()} GitHub stars`}
                  asSpan
                  trigger={
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
                        fontWeight: 600,
                        marginLeft: '0.2rem',
                        lineHeight: 1,
                        cursor: 'pointer',
                      }}
                    >
                      <Star size={12} fill="#d97706" color="#d97706" />
                      {server.githubStars >= 1000 ? `${(server.githubStars / 1000).toFixed(1)}k` : server.githubStars.toLocaleString()}
                    </span>
                  }
                >
                  <span className="mcp-icon-tooltip-title">
                    <Star size={14} fill="#d97706" color="#d97706" /> GitHub Stars
                  </span>
                  <span className="mcp-icon-tooltip-body">
                    Total stargazers on GitHub for the source repository ({server.githubStars.toLocaleString()} stars).
                  </span>
                </IconTooltip>
              )}
            </OutboundLink>

            {server.websiteUrl && (
              <OutboundLink
                href={server.websiteUrl}
                destinationType="website"
                serverId={server.id}
                target="_blank"
                rel={websiteLinkRel(!!server.isPremium, !!server.websiteBacklinkOk)}
                className="mcp-action-btn mcp-action-btn--accent"
              >
                <Globe size={18} style={{ color: 'var(--accent-color)' }} />
                <span className="mcp-action-btn-label">Visit Website</span>
                {server.websiteBacklinkOk ? (
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
                rel={supportLinkRel(!!server.isPremium, !!server.websiteBacklinkOk, server.supportUrl, server.websiteUrl)}
                className="mcp-action-btn"
              >
                <LifeBuoy size={18} style={{ color: 'var(--accent-color)' }} />
                <span className="mcp-action-btn-label">Support</span>
              </OutboundLink>
            )}

            <ShareModal serverId={server.id} serverName={server.name} variant="action" />
            <ReportListingButton serverId={server.id} />
          </div>
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
                  {(server.remoteEndpointHealthy != null || server.id === 'allmcps-server') && (() => {
                    const isHealthy = server.id === 'allmcps-server' || server.remoteEndpointHealthy === true;
                    return (
                      <IconTooltip
                        label="Hosted endpoint health"
                        asSpan
                        trigger={
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: isHealthy ? '#34d399' : '#f87171',
                              marginLeft: '0.2rem',
                              cursor: 'pointer',
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: isHealthy ? '#34d399' : '#f87171',
                              }}
                            />
                            {isHealthy ? 'Live' : 'Unreachable'}
                            {formatCommitAge(server.remoteEndpointCheckedAt) ? ` · ${formatCommitAge(server.remoteEndpointCheckedAt)}` : ''}
                          </span>
                        }
                      >
                        <span className="mcp-icon-tooltip-title">
                          <span
                            className="mcp-icon-tooltip-dot"
                            style={{ backgroundColor: isHealthy ? '#34d399' : '#f87171' }}
                          />
                          {isHealthy ? 'Live Remote Endpoint' : 'Remote Endpoint Unreachable'}
                        </span>
                        <span className="mcp-icon-tooltip-body">
                          {isHealthy
                            ? 'Our automated health check connected to this remote MCP endpoint successfully.'
                            : 'Our automated health check could not connect to this remote SSE endpoint.'}
                        </span>
                        <span className="mcp-icon-tooltip-meta">
                          {server.remoteEndpointCheckedAt
                            ? `Last checked ${new Date(server.remoteEndpointCheckedAt).toLocaleString()}`
                            : 'Live on-site API endpoint.'}
                        </span>
                      </IconTooltip>
                    );
                  })()}
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

            {(pilotResult || (server.installKind === 'stdio' && server.installCommand)) && (
              <div
                style={{
                  marginTop: '1.25rem',
                  borderRadius: '10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  padding: '0.85rem 1rem',
                }}
              >
                {server.id === 'allmcps-server' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      <CheckCircle size={14} style={{ color: '#34d399' }} /> Official Flagship Server
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                      Official MCP server for AllMCPs.com — maintained directly by AllMCPs. Fully verified to search, introspect, and manage MCP tools programmatically directly from your AI agent prompts.
                    </p>
                  </>
                ) : !pilotResult ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      <Clock size={14} style={{ color: 'var(--text-secondary)' }} /> Not yet automatically verified
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                      {hasIntrospectedTools
                        ? "This server is confirmed live — we successfully called its tools/list endpoint directly (see the verified badge above). We haven't yet sandbox-tested the stdio install command below specifically, which is a separate, ongoing check."
                        : "We haven't yet run this listing's install command through our automated sandbox check. This isn't a red flag — we're steadily working through the catalog."}
                    </p>
                  </>
                ) : pilotResult.status === 'ok' ? (
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
                      {!server.isOfficial && <ClaimHintLink serverId={server.id} />}
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
            {reviewSummary.count > 0 && (
              <a href="#reviews" className="detail-next-step">
                <Star size={14} aria-hidden="true" /> Reviews ({reviewSummary.count})
              </a>
            )}
            {!server.isOfficial && (
              <Link href={`/mcp/${server.id}/claim`} className="detail-next-step">
                <BadgeCheck size={14} aria-hidden="true" /> Claim listing
              </Link>
            )}
            <Link href={`/mcp/${server.id}/alternatives`} className="detail-next-step" rel="nofollow">
              <Sparkles size={14} aria-hidden="true" /> Alternatives
            </Link>
            <Link href={`/categories/${catSlug}`} className="detail-next-step">
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
                  (() => {
                    // Only the long tail of giant READMEs is trimmed here — most
                    // render in full. Keeps the mirrored upstream content from
                    // bloating the HTML (CWV) and out-weighting this page's own
                    // unique content, while still linking to the full source.
                    const { excerpt, truncated } = truncateReadmeExcerpt(readme);
                    return (
                      <>
                        <SafeMarkdown content={excerpt ?? readme} utmContent={server.id} repoUrl={server.url} />
                        {truncated && (
                          <p style={{ marginTop: '1.25rem' }}>
                            <OutboundLink
                              href={server.url}
                              destinationType="github"
                              serverId={server.id}
                              target="_blank"
                              rel={repoLinkRel(!!server.isPremium, !!server.isOfficial)}
                            >
                              Read the full README on {repoHost || 'the source repository'} →
                            </OutboundLink>
                          </p>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <>
                    <p>
                      {displayName} is a {server.category} MCP server{org ? ` from ${org}` : ''} listed on
                      AllMCPs. {server.description}
                    </p>
                    {/* When the listing already has a supplied description, this apologetic
                        "no README" chrome is redundant with the sentence above — hide it. */}
                    {!hasSuppliedDescription && (
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
                    )}
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
                    rel="nofollow"
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
                    rel="nofollow"
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

          <ReviewsSection serverId={server.id} summary={reviewSummary} />

          {/* Query-Forward AEO / FAQ Block */}
          <section style={{ marginTop: '2.5rem' }}>
            <FaqSection
              renderJsonLd={false}
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
                <Link href={`/categories/${catSlug}`} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textAlign: 'right', minWidth: 0 }}>
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

            <HealthHistoryStrip
              history={healthHistory}
              pilotResult={pilotResult}
              hasRemoteEndpoint={!!server.remoteEndpointUrl}
              isOfficial={server.isOfficial || server.id === 'allmcps-server'}
            />

            {/* Popularity signals — 2-up grid reads faster and takes less vertical space than one full-width row each. */}
            <div className="detail-stats-grid">
              <ViewTracker serverId={server.id} initialCount={server.views || 0} />
              <InstallsStat count={server.copies || 0} />
              {typeof server.githubStars === 'number' && (
                <IconTooltip
                  label="GitHub stars count"
                  asSpan
                  trigger={
                    <div className="detail-stat-item" style={{ cursor: 'pointer' }}>
                      <span className="detail-stat-item-label">
                        <Star size={12} style={{ color: '#f5c518' }} /> GitHub stars
                      </span>
                      <span className="detail-stat-item-value">{server.githubStars.toLocaleString()}</span>
                    </div>
                  }
                >
                  <span className="mcp-icon-tooltip-title">
                    <Star size={14} style={{ color: '#f5c518', fill: '#f5c518' }} /> GitHub Star Count
                  </span>
                  <span className="mcp-icon-tooltip-body">
                    Total stargazers on GitHub representing community popularity ({server.githubStars.toLocaleString()} stars).
                  </span>
                </IconTooltip>
              )}
              {formatCommitAge(server.lastCommitAt) && (
                <IconTooltip
                  label="Last commit status"
                  asSpan
                  trigger={
                    <div className="detail-stat-item" style={{ cursor: 'pointer' }}>
                      <span className="detail-stat-item-label">
                        <Clock size={12} style={{ color: 'var(--accent-color)' }} /> Last commit
                      </span>
                      <span className="detail-stat-item-value">{formatCommitAge(server.lastCommitAt)}</span>
                    </div>
                  }
                >
                  <span className="mcp-icon-tooltip-title">
                    <Clock size={14} style={{ color: 'var(--accent-color)' }} /> Last Repository Commit
                  </span>
                  <span className="mcp-icon-tooltip-body">
                    The most recent commit or push recorded for this server's GitHub repository.
                  </span>
                  <span className="mcp-icon-tooltip-meta">
                    {formatFullDate(server.lastCommitAt)
                      ? `Last commit on ${formatFullDate(server.lastCommitAt)}`
                      : 'Refreshed automatically via GitHub API.'}
                  </span>
                </IconTooltip>
              )}
              {typeof server.npmDownloads === 'number' && (
                <IconTooltip
                  label="Monthly npm downloads"
                  asSpan
                  trigger={
                    <div className="detail-stat-item" style={{ cursor: 'pointer' }}>
                      <span className="detail-stat-item-label">
                        <Download size={12} style={{ color: 'var(--accent-color)' }} /> npm downloads
                      </span>
                      <span className="detail-stat-item-value">{server.npmDownloads.toLocaleString()}/mo</span>
                    </div>
                  }
                >
                  <span className="mcp-icon-tooltip-title">
                    <Download size={14} style={{ color: 'var(--accent-color)' }} /> Monthly npm Downloads
                  </span>
                  <span className="mcp-icon-tooltip-body">
                    Average monthly package installs recorded from npm registry statistics.
                  </span>
                </IconTooltip>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <QualityBadge server={serverForScoring} />
            </div>
          </div>

          <VulnSignalCard server={server} />

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
                <CheckCircle size={18} color="var(--accent-color)" /> Own this project?
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.55 }}>
                This directory is pre-filled from public sources. Claim via GitHub README, site badge, or DNS TXT to unlock edit access and the Official badge
                {server.websiteUrl ? '' : ' and attach your website'} — proof is checked automatically, then reviewed by our team.
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
                <strong style={{ color: 'var(--verified-green)' }}>Free dofollow backlink:</strong> add your website
                and place the AllMCPs badge on it — no claim needed. We detect it automatically and keep it verified
                as long as the badge stays live.
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
          ) : null}

          <AdminQuickBar server={server} />

          <OwnerZone
            serverId={server.id}
            isOfficial={!!server.isOfficial}
            websiteUrl={server.websiteUrl}
            isPremium={server.isPremium}
            websiteBacklinkOk={server.websiteBacklinkOk}
            status={server.status}
            featuredUntil={server.featuredUntil}
            categorySponsorUntil={server.categorySponsorUntil}
          />

          <SponsorAdUnit placement="detail_sidebar" />

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
                    rel="nofollow"
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
