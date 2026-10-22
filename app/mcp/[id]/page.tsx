import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle,
  ChevronDown,
  Clock,
  Code2,
  Crown,
  Download,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe,
  Info,
  LifeBuoy,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Star,
  Terminal,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { ExpandableDoc } from '@/components/listing/ExpandableDoc';
import { InstallPanel } from '@/components/listing/InstallPanel';
import { ListingMoreMenu } from '@/components/listing/ListingMoreMenu';
import {
  type ListingSection,
  ListingSectionNav,
} from '@/components/listing/ListingSectionNav';
import { ListingVisibilityNotice } from '@/components/listing/ListingVisibilityNotice';
import { MCP_CLIENTS } from '@/lib/clients';
import { assessInstallRisk } from '@/lib/installRisk';
import { serializeJsonLd } from '@/lib/jsonLd';
import { isListingIndexable } from '@/lib/listingIndexability';
import { buildListingMetaDescription } from '@/lib/listingMeta';
import { isRepositoryUrl } from '@/lib/repoUrl';
import { parseSecurityProfile } from '@/lib/securityProfile';
import {
  AUTH_TYPE_LABELS,
  type AuthType,
  MAINTENANCE_STATUS_LABELS,
  type MaintenanceStatus,
  PRICING_MODEL_LABELS,
  type PricingModel,
} from '@/lib/serverEnums';
import { SponsorAdUnit } from '../../../components/ads/SponsorAdUnit';
import { CollapsibleText } from '../../../components/CollapsibleText';
import { ImpressionBeacon } from '../../../components/ImpressionTracker';
import { MobileInstallBar } from '../../../components/MobileInstallBar';
import ShareModal from '../../../components/ShareModal';
import {
  AdminInlineCategory,
  AdminInlineDescription,
  AdminInlineLinkPopover,
  AdminInlineName,
  AdminProvider,
  AdminTopBar,
} from '../../../components/ui/AdminListingControls';
import { AdoptionSignals } from '../../../components/ui/AdoptionSignals';
import { ClaimHintLink } from '../../../components/ui/ClaimHintLink';
import { CopyBlock } from '../../../components/ui/CopyBlock';
import { DirectoryBadgeCard } from '../../../components/ui/DirectoryBadgeCard';
import { FaqSection } from '../../../components/ui/FaqSection';
import { FlagshipHeroBanner } from '../../../components/ui/FlagshipHeroBanner';
import { HealthHistoryStrip } from '../../../components/ui/HealthHistoryStrip';
import { IconTooltip } from '../../../components/ui/IconTooltip';
import { OutboundLink } from '../../../components/ui/OutboundLink';
import { OwnerZone } from '../../../components/ui/OwnerZone';
import { QualityBadge } from '../../../components/ui/QualityBadge';
import { ReportListingButton } from '../../../components/ui/ReportListingButton';
import { ReviewNudge } from '../../../components/ui/ReviewNudge';
import { ReviewsSection } from '../../../components/ui/ReviewsSection';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { ScreenshotViewer } from '../../../components/ui/ScreenshotViewer';
import { SecurityProfileCard } from '../../../components/ui/SecurityProfileCard';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { ToolSchemaInspector } from '../../../components/ui/ToolSchemaInspector';
import { TrustTierBadge } from '../../../components/ui/TrustTierBadge';
import { UpvoteButton } from '../../../components/ui/UpvoteButton';
import { InstallsStat, ViewTracker } from '../../../components/ui/ViewTracker';
import { VulnSignalCard } from '../../../components/ui/VulnSignalCard';
import serversData from '../../../data/mcp-servers.json';
import {
  bestTopicForCategory,
  keywordTopicsForServer,
} from '../../../lib/bestTopics';
import {
  categoryHueClass,
  categorySlug,
  getCategoryMeta,
} from '../../../lib/categories';
import { parseServerName } from '../../../lib/displayName';
import {
  isFeaturedListing,
  isVerifiedListing,
} from '../../../lib/featuredStatus';
import {
  formatCommitAge,
  formatCompactNumber,
  formatFullDate,
  publicViewCount,
} from '../../../lib/format';
import {
  isUnverifiedInstall,
  parseArgsJson,
  resolveInstallConfig,
  runtimeLabel,
  transportLabel,
} from '../../../lib/installConfig';
import {
  repoLinkRel,
  supportLinkRel,
  websiteLinkRel,
} from '../../../lib/linkRel';
import { redirectIfListingMoved } from '../../../lib/listingRedirect';
import { statusHueClass } from '../../../lib/palette';
import {
  computeCombinedAvailabilityPct,
  getFeaturedServers,
  getRelatedServers,
  getServerById,
  getServerHealthHistory,
  getServerReviews,
  getServerSignalsById,
  getStdioVerification,
  type Server,
  truncateReadmeExcerpt,
} from '../../../lib/servers';
import { listingLastMod } from '../../../lib/sitemapHelpers';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    // A missing listing must not return a 200 "Not Found" body (soft 404) — mark it
    // noindex here and serve a real 404 from the page component below.
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }

  redirectIfListingMoved(id, server);

  const desc = buildListingMetaDescription(server);

  const { displayName } = parseServerName(server.name, server.url);
  const title = buildDetailTitle(displayName);

  // Same rule the listings sitemap uses (lib/listingIndexability.ts), so we
  // never submit a URL this page noindexes. follow stays on so link equity
  // still flows through noindexed listings.
  const isThinListing = !isListingIndexable({
    status: server.status,
    hasAiDoc: Boolean(server.aiDoc?.trim()),
    toolsSource: server.toolsSource,
    installNeedsConfig: server.installNeedsConfig,
    remoteEndpointHealthy: server.remoteEndpointHealthy,
    githubStars: server.githubStars,
    npmDownloads: server.npmDownloads,
    staleFlagged: server.staleFlaggedAt != null,
  });

  const robotsOverride =
    server.status === 'removed'
      ? { robots: { index: false, follow: false } as const }
      : isThinListing
        ? { robots: { index: false, follow: true } as const }
        : {};

  return {
    title,
    description: desc,
    keywords: [
      server.name,
      'MCP server',
      'Model Context Protocol',
      'AI agent tool',
      server.category,
    ].join(', '),
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

const README_FETCH_TIMEOUT_MS = 5000;

async function fetchReadme(url: string) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;

    const owner = match[1];
    let repo = match[2];

    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }

    // Attempt to fetch from 'main' branch first. Bounded: this runs inside the
    // page's ISR re-render, and a slow GitHub response could hold that render
    // past the memory queue's revalidation timeout (open-next.config.ts).
    let res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
      {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(README_FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      // Fallback to 'master' branch
      res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
        {
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(README_FETCH_TIMEOUT_MS),
        },
      );
    }

    if (res.ok) {
      const text = await res.text();
      return text.length > 250000
        ? `${text.slice(0, 250000)}\n\n*(README truncated for size)*`
        : text;
    }
    return null;
  } catch (_e) {
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

export default async function MCPDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    // Serve a genuine HTTP 404 (via app/not-found.tsx) instead of a 200 page with a
    // "not found" body — the latter is a soft 404 that wastes crawl budget and can get
    // an empty URL indexed.
    notFound();
  }

  redirectIfListingMoved(id, server);

  // Independent I/O (external README fetch, two category/featured lookups, a verification-check
  // query) — run concurrently instead of one big sequential waterfall.
  // getRelatedServers and getFeaturedServers use targeted D1 category/featured queries
  // (see lib/servers.ts) to keep memory footprint < 2MB.
  // Deliberately no session/auth() read here — that would force this page dynamic
  // (uncacheable) on every request. Ownership-gated UI (OwnerZone, ClaimHintLink)
  // fetches its own status client-side instead so this page can be ISR'd.
  // Once this listing has our own restructured writeup (server.aiDoc), the page
  // body renders that and links out to the README — no raw-README mirror on the
  // indexed page (that duplicate is what got these pages reranked; the full
  // README lives at the noindex /mcp/[id]/readme route). Until the enrich cron
  // reaches this row, fall back to the README excerpt as before so the page
  // isn't thinner in the interim.
  const needsReadmeFallback = !server.aiDoc?.trim();
  const [
    readme,
    relatedServers,
    rawVerification,
    featuredPool,
    healthHistory,
    reviewSummary,
    signals,
  ] = await Promise.all([
    needsReadmeFallback ? fetchReadme(server.url) : Promise.resolve(null),
    getRelatedServers(server as any, 4),
    getStdioVerification(server.id),
    getFeaturedServers(server.id, 10),
    getServerHealthHistory(server.id),
    getServerReviews(server.id),
    getServerSignalsById(server.id),
  ]);
  // Trust tier and security card read listing_signals fields; merged here
  // rather than in getServerById so other callers don't pay for the read.
  const serverWithSignals = { ...server, ...signals };
  // A verification is only meaningful for the install command it actually
  // tested. install_extracted_at (LLM re-validation) can rewrite that
  // command after the verification ran — stale otherwise, showing a mismatched
  // command/error pairing that never actually happened together.
  const verification =
    rawVerification &&
    (!server.installExtractedAt ||
      new Date(rawVerification.checkedAt).getTime() >=
        new Date(server.installExtractedAt).getTime())
      ? rawVerification
      : null;
  // Rolling remote-endpoint history combined with a confirmed-fresh verification
  // pass — see computeCombinedAvailabilityPct in lib/servers.ts for why this
  // takes priority over a single live snapshot in the quality score.
  const combinedAvailabilityPct = computeCombinedAvailabilityPct(
    healthHistory,
    verification?.status === 'ok',
  );
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
  const catHue = categoryHueClass(server.category);

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
      tone: statusHueClass('ok'),
      detail: 'Recent health check succeeded.',
    },
    down: {
      label: 'Health: Issues detected',
      tone: statusHueClass('bad'),
      detail: 'Last health check failed or the endpoint looked unhealthy.',
    },
    unknown: {
      label: 'Health: Not checked yet',
      tone: '',
      detail: 'We have not completed a health check for this listing yet.',
    },
  }[healthKey];

  // Sidebar spotlight: always a paid featured listing when any exist (the
  // "spotlight your server" upsell shows only when none do). The pick is a
  // stable hash of this listing's id, not Math.random(): the page is ISR-cached,
  // so a random roll froze one outcome per page for the whole revalidate window
  // (often the upsell). Hashing spreads every featured server evenly across
  // the catalog's listing pages instead.
  let spotlightHash = 0;
  for (let i = 0; i < server.id.length; i++) {
    spotlightHash =
      (Math.imul(spotlightHash, 31) + server.id.charCodeAt(i)) | 0;
  }
  const spotlightPick =
    featuredPool.length > 0
      ? featuredPool[Math.abs(spotlightHash) % featuredPool.length]
      : null;
  // The mcpServers key just needs to be a readable identifier; the npx arg below
  // uses server.name verbatim since that's typically the real package name
  // (e.g. "@agentfund/mcp") and slugifying it would produce a nonexistent package.
  const installSlug =
    (server.name.split('/').pop() || server.name)
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

  // `server.url` is just "the primary submitted link" — for a listing whose
  // source is private it's the vendor's homepage, not a repo. Only render the
  // repository affordance when the link genuinely is one, and let the website
  // button fall back to it so a closed-source listing still has one honest,
  // correctly-labelled outbound link instead of two (one of them lying).
  const hasRepository = isRepositoryUrl(server.url);
  const primaryWebsiteUrl =
    server.websiteUrl || (hasRepository ? null : server.url);

  const canonicalUrl = `https://allmcps.com/mcp/${server.id}`;
  // The route-generated OG card always exists for every listing, so it's a safe,
  // stable image for structured data (Google requires an image for the richest
  // SoftwareApplication results, and answer engines surface it in citations).
  const ogImage = `${canonicalUrl}/opengraph-image`;
  const sameAs = [server.url, server.websiteUrl].filter(Boolean) as string[];
  const publishedDate = server.createdAt ? new Date(server.createdAt) : null;
  const publishedIso =
    publishedDate && !Number.isNaN(publishedDate.getTime())
      ? publishedDate.toISOString()
      : undefined;
  // Honest content-freshness stamp — newest of the writeup / FAQ / enrichment /
  // install re-check / upstream commit (NOT lastCheckedAt, which the health cron
  // rewrites every ~15 min). Same value the sitemap emits for this URL, so the
  // visible "Last updated" and the sitemap lastmod always agree. See
  // lib/sitemapHelpers.ts listingLastMod.
  const contentUpdatedIso = listingLastMod(server);
  const contentUpdatedLabel = formatFullDate(contentUpdatedIso);
  // Map real engagement counters to schema.org InteractionCounter — never a
  // fabricated aggregateRating, which we don't collect and which risks penalties.
  const interactionStatistic = [
    publicViewCount(server)
      ? {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/ViewAction',
          userInteractionCount: publicViewCount(server),
        }
      : null,
    server.copies
      ? {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/InstallAction',
          userInteractionCount: server.copies,
        }
      : null,
    server.upvotes
      ? {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/LikeAction',
          userInteractionCount: server.upvotes,
        }
      : null,
  ].filter(Boolean);

  // The fallback FAQ used to state a config block as fact — always `npx -y <listing
  // name>` — no matter what this listing actually is. For a hosted service with no npm
  // package that answer is simply wrong, and it read as authoritative because it sits in
  // the same FAQ as the real, AI-extracted answers. Derive it from the same resolver the
  // install buttons use, and when that resolver only has a guess, say we don't have a
  // confirmed command instead of inventing one.
  const fallbackInstall = resolveInstallConfig({
    id: server.id,
    name: server.name,
    url: server.url,
    description: server.description,
    remoteEndpointUrl: server.remoteEndpointUrl,
    installKind: server.installKind,
    installCommand: server.installCommand,
    installArgs: server.installArgs,
    installPackage: server.installPackage,
    installConfidence: server.installConfidence,
    suggestedInstallCommand: server.suggestedInstallCommand,
    suggestedInstallArgs: server.suggestedInstallArgs,
  });
  const detailTransport = transportLabel(fallbackInstall);
  const detailRuntime = runtimeLabel(fallbackInstall);
  const fallbackInstallAnswer = isUnverifiedInstall(fallbackInstall)
    ? `We don't have a confirmed install command for ${server.name} yet, so we don't publish a generated one — a guessed package name would point at the wrong package or none at all. Follow the project's own README or setup instructions (${server.url}) for the current steps.`
    : fallbackInstall.kind === 'remote'
      ? `${server.name} is a hosted MCP server. Add it as a remote server in your client's config: "mcpServers": { "${installSlug}": { "url": "${fallbackInstall.url}" } }`
      : `Add the following block to your claude_desktop_config.json under mcpServers: "mcpServers": { "${installSlug}": { "command": "${fallbackInstall.command}", "args": ${JSON.stringify(fallbackInstall.args)} } }`;

  // This answer used to be a flat "Yes — free and open" for every listing, which is a
  // claim about someone else's product that we have no basis for: a hosted service with
  // a signup and a paid tier got described as free on its own listing page. `pricingModel`
  // is self-declared by the submitter/owner and is often unset, so say what was declared,
  // and when nothing was, say that rather than guessing in the generous direction.
  const pricingNote = server.pricingNotes?.trim()
    ? ` ${server.pricingNotes.trim()}`
    : '';
  const fallbackPricingAnswer = ((): string => {
    switch (server.pricingModel) {
      case 'free':
        return `The maintainer lists ${server.name} as free to use.${pricingNote}`;
      case 'freemium':
        return `${server.name} is listed as freemium — there's a free tier, with paid plans beyond it.${pricingNote}`;
      case 'paid':
        return `No — ${server.name} is listed as a paid service. Check the project's own pricing for current details.${pricingNote}`;
      case 'byok':
        return `${server.name} is listed as bring-your-own-key: the server itself is free to run, but it calls an API you supply your own key for, so usage is billed by that provider.${pricingNote}`;
      default:
        return `We don't have confirmed pricing for ${server.name}. Listing it on AllMCPs is free, but that says nothing about what the server itself costs — check the project's own site for current pricing.${pricingNote}`;
    }
  })();

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
            a: fallbackInstallAnswer,
          },
          { q: `What does ${server.name} do?`, a: server.description },
          {
            q: `Is the ${server.name} MCP server free to use?`,
            a: fallbackPricingAnswer,
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
        url: `${canonicalUrl}#install`,
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
      softwareRequirements:
        'Node.js, npx, Claude Desktop or MCP compatible client',
      isAccessibleForFree: true,
      keywords: [
        server.name,
        'MCP server',
        'Model Context Protocol',
        'AI agent tool',
        server.category,
      ].join(', '),
      ...(publishedIso ? { datePublished: publishedIso } : {}),
      ...(contentUpdatedIso ? { dateModified: contentUpdatedIso } : {}),
      ...(org
        ? {
            author: {
              '@type': 'Organization',
              name: org,
              ...(server.url ? { url: server.url } : {}),
            },
          }
        : {}),
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
            mainEntity: (server.aiFaq ?? []).map((item) => ({
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

  const toolCount = server.tools?.length ?? 0;
  const hasSecurityCard =
    Boolean(parseSecurityProfile(serverWithSignals.securityProfile)) ||
    assessInstallRisk(serverWithSignals).length > 0;
  const hasVulnCard = server.vulnScannedAt != null;
  const hasAiOverview = Boolean(
    server.aiOverview ||
      (server.aiUseCases?.length ?? 0) > 0 ||
      (server.aiFeatures?.length ?? 0) > 0,
  );
  const hasRelated = Boolean(relatedServers && relatedServers.length > 0);
  const sections: ListingSection[] = [
    { id: 'install', label: 'Install' },
    { id: 'overview', label: 'Overview' },
    ...(toolCount > 0
      ? [{ id: 'tools-schema', label: 'Tools', count: toolCount }]
      : []),
    { id: 'security', label: 'Security' },
    { id: 'how-it-works', label: 'How it works' },
    { id: 'reviews', label: 'Reviews', count: reviewSummary.count },
    { id: 'faq', label: 'FAQ' },
    ...(hasRelated ? [{ id: 'alternatives', label: 'Alternatives' }] : []),
  ];
  const starsLabel =
    typeof server.githubStars === 'number' && server.githubStars > 0
      ? formatCompactNumber(server.githubStars)
      : null;
  const remoteHealthy =
    server.id === 'allmcps-server' || server.remoteEndpointHealthy === true;
  const showRemoteHealth =
    server.remoteEndpointHealthy != null || server.id === 'allmcps-server';
  const best = bestTopicForCategory(server.category);
  const keywordHubs = keywordTopicsForServer(server).filter(
    (t) => t.slug !== best?.slug,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <AdminProvider serverId={server.id}>
        <main className="container lst-page">
          {/* Only the fields the bar reads — passing the whole row serialized
              every listing column into the RSC payload for every visitor. */}
          <AdminTopBar
            server={{
              id: server.id,
              status: server.status,
              featuredUntil: server.featuredUntil,
            }}
          />
          <nav aria-label="Breadcrumb" className="animate-fade">
            <ol className="crumbs">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <AdminInlineCategory
                  serverId={server.id}
                  currentCategory={server.category}
                  categorySlug={catSlug}
                />
              </li>
              <li aria-current="page">{displayName}</li>
            </ol>
          </nav>

          {server.status === 'removed' && (
            <div role="alert" className="lst-alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <p className="lst-alert-title">This listing appears offline</p>
                <p className="lst-alert-body">
                  Our automated checks couldn&rsquo;t reach the source
                  repository, so we&rsquo;ve removed it from search, browse, and
                  the API — this page stays reachable at this direct link only.
                  {!server.isOfficial &&
                    ' If this is your project, claim it to fix the link and restore visibility.'}
                </p>
                {!server.isOfficial && (
                  <Link
                    href={`/mcp/${server.id}/claim`}
                    className="btn btn-secondary btn-sm"
                  >
                    <BadgeCheck size={14} aria-hidden="true" /> Claim this
                    listing
                  </Link>
                )}
              </div>
            </div>
          )}

          <ListingVisibilityNotice
            serverId={server.id}
            status={server.status}
            staleFlaggedAt={server.staleFlaggedAt}
            staleReasons={signals.staleReasons}
            isOfficial={server.isOfficial}
          />

          {/* ── Header ─────────────────────────────────────────────── */}
          <header className="lst-hero">
            <div className="lst-hero-id animate-in">
              {/* Prefer approved R2 logo, else GitHub org avatar, else category gradient (ServerAvatar). */}
              <ServerAvatar
                name={server.name}
                logoUrl={server.logoUrl}
                category={server.category}
                size={64}
                priority
              />
              <div className="lst-hero-text">
                <div className="lst-title-row">
                  <h1 className="lst-title">
                    <AdminInlineName
                      serverId={server.id}
                      initialName={displayName}
                    />
                  </h1>
                  {/* Paid placements are always labelled beside the name. */}
                  {server.isPremium ? (
                    <span className="lst-paid-badge tint-pill hue-amber">
                      <Crown size={13} aria-hidden="true" /> Premium
                    </span>
                  ) : isFeaturedListing(server) ? (
                    <span className="lst-paid-badge tint-pill hue-amber">
                      <Sparkles size={13} aria-hidden="true" /> Featured
                    </span>
                  ) : null}
                </div>
                {org && <p className="lst-org">by {org}</p>}
              </div>
            </div>

            <div
              className="lst-hero-summary animate-in"
              style={{ '--i': 1 } as CSSProperties}
            >
              <AdminInlineDescription
                serverId={server.id}
                initialDescription={
                  server.aiSummary?.trim() || server.description || ''
                }
                rendered={
                  <SafeMarkdown
                    content={
                      server.aiSummary?.trim() || server.description || ''
                    }
                    utmContent={server.id}
                    repoUrl={server.url}
                  />
                }
              />
            </div>

            {/* Trust signals — one compact, scannable row. */}
            <ul
              className="lst-meta animate-in"
              style={{ '--i': 2 } as CSSProperties}
              aria-label="Listing signals"
            >
              {isVerifiedListing(server) && (
                <li>
                  <IconTooltip
                    label={
                      server.isOfficial
                        ? 'Ownership verified'
                        : 'Premium listing'
                    }
                    trigger={
                      <span className="lst-meta-badge lst-meta-badge--accent">
                        <BadgeCheck size={14} aria-hidden="true" />
                        {server.isOfficial ? 'Verified owner' : 'Premium'}
                      </span>
                    }
                  >
                    <span className="mcp-icon-tooltip-title">
                      <BadgeCheck size={14} color="var(--accent-color)" />
                      {server.isOfficial
                        ? 'Ownership verified'
                        : 'Premium listing'}
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      {server.isOfficial
                        ? 'The owner proved control of this listing via a GitHub README, site badge, or DNS TXT record.'
                        : 'This listing has an active Premium subscription. Ownership has not been separately verified.'}
                    </span>
                  </IconTooltip>
                </li>
              )}
              {server.isPremium && !isVerifiedListing(server) && (
                <li>
                  <IconTooltip
                    label="Premium listing"
                    trigger={
                      <span className="lst-meta-badge">
                        <Crown size={13} aria-hidden="true" /> Premium
                      </span>
                    }
                  >
                    <span className="mcp-icon-tooltip-title">
                      <Crown size={14} color="#facc15" /> Premium listing
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      This owner pays for enhanced visibility — priority
                      placement in search, category pages, and rotating
                      spotlight slots across the directory.
                    </span>
                  </IconTooltip>
                </li>
              )}
              {isFeaturedListing(server) && (
                <li>
                  <IconTooltip
                    label="Featured listing"
                    trigger={
                      <span className="lst-meta-badge">
                        <Star size={13} aria-hidden="true" /> Featured
                      </span>
                    }
                  >
                    <span className="mcp-icon-tooltip-title">
                      <Star size={14} color="var(--accent-color)" /> Featured
                      listing
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      {server.isPremium
                        ? 'Included with this listing’s active Premium subscription — boosted placement across search, category pages, and homepage spotlight rotation.'
                        : 'Currently boosted for extra visibility — priority placement across search, category pages, and homepage spotlight rotation.'}
                    </span>
                  </IconTooltip>
                </li>
              )}
              <li className="lst-meta-tier">
                <TrustTierBadge server={serverWithSignals} />
              </li>
              <li>
                {/* Drives the health dot — one tooltip-bearing indicator. */}
                <IconTooltip
                  label={`Health status: ${healthUi.label}`}
                  trigger={
                    <span
                      className={`lst-health lst-health--${healthKey} ${healthUi.tone}`}
                    >
                      <span className="lst-health-dot" aria-hidden="true" />
                      {healthKey === 'active'
                        ? 'Healthy'
                        : healthKey === 'down'
                          ? 'Issues detected'
                          : 'Not checked yet'}
                    </span>
                  }
                >
                  <span className="mcp-icon-tooltip-title">
                    <span
                      className={`mcp-icon-tooltip-dot lst-health-tip ${healthUi.tone}`}
                    />
                    {healthUi.label}
                  </span>
                  <span className="mcp-icon-tooltip-body">
                    {healthUi.detail}
                  </span>
                  <span className="mcp-icon-tooltip-meta">
                    {server.lastCheckedAt
                      ? `Last checked ${new Date(server.lastCheckedAt).toLocaleString()}`
                      : 'No health check has run yet.'}
                  </span>
                </IconTooltip>
              </li>
              <li>
                <Link
                  href={`/categories/${catSlug}`}
                  className={`lst-meta-link lst-cat-pill tint-pill ${catHue}`}
                >
                  <span aria-hidden="true">{catMeta.emoji}</span>
                  {categoryLabel}
                </Link>
              </li>
              {starsLabel && (
                <li>
                  <span
                    className="lst-meta-item"
                    title={`${server.githubStars?.toLocaleString()} GitHub stars`}
                  >
                    <Star size={13} aria-hidden="true" />
                    <span className="tabular">{starsLabel}</span>
                    <span className="lst-meta-unit">stars</span>
                  </span>
                </li>
              )}
              <li>
                <a href="#reviews" className="lst-meta-link">
                  <IconTooltip
                    label={
                      reviewSummary.count > 0
                        ? `${reviewSummary.avgRating.toFixed(1)} stars out of 5 (${reviewSummary.count} ${reviewSummary.count === 1 ? 'rating' : 'ratings'})`
                        : 'No ratings yet — click to review'
                    }
                    asSpan
                    trigger={
                      <span className="lst-meta-item">
                        <Star
                          size={13}
                          aria-hidden="true"
                          className={
                            reviewSummary.count > 0 ? 'lst-star-on' : undefined
                          }
                        />
                        {reviewSummary.count > 0 ? (
                          <>
                            <span className="tabular">
                              {reviewSummary.avgRating.toFixed(1)}
                            </span>
                            <span className="lst-meta-unit">
                              ({reviewSummary.count})
                            </span>
                          </>
                        ) : (
                          <span className="lst-meta-unit">No ratings</span>
                        )}
                      </span>
                    }
                  >
                    <span className="mcp-icon-tooltip-title">
                      <Star size={14} fill="#fbbf24" color="#fbbf24" /> User
                      Ratings
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      {reviewSummary.count > 0
                        ? `Rated ${reviewSummary.avgRating.toFixed(1)} / 5.0 across ${reviewSummary.count} user ${reviewSummary.count === 1 ? 'review' : 'reviews'}. Click to view or leave a rating.`
                        : 'Be the first to rate and review this MCP server!'}
                    </span>
                  </IconTooltip>
                </a>
              </li>
              {(server.copies ?? 0) > 0 && (
                <li>
                  <span className="lst-meta-item">
                    <Download size={13} aria-hidden="true" />
                    <span className="tabular">
                      {formatCompactNumber(server.copies)}
                    </span>
                    <span className="lst-meta-unit">installs</span>
                  </span>
                </li>
              )}
              {contentUpdatedLabel && (
                <li>
                  <span className="lst-meta-item">
                    <Clock size={13} aria-hidden="true" />
                    <span className="lst-meta-unit">Updated</span>
                    {contentUpdatedLabel}
                  </span>
                </li>
              )}
              {!server.aiEnrichedAt && (
                <li>
                  <IconTooltip
                    label="Enrichment pending"
                    trigger={
                      <span className="lst-meta-badge lst-meta-badge--muted">
                        <Clock size={13} aria-hidden="true" /> Enrichment
                        pending
                      </span>
                    }
                  >
                    <span className="mcp-icon-tooltip-title">
                      <Clock size={14} /> Enrichment pending
                    </span>
                    <span className="mcp-icon-tooltip-body">
                      We haven&rsquo;t run our AI enrichment pass on this
                      listing yet, so the overview, use cases, and FAQ below may
                      be sparse or missing. We work through the catalog over
                      time — check back soon.
                    </span>
                  </IconTooltip>
                </li>
              )}
            </ul>

            {/* Actions: one primary (Install), the rest quiet. */}
            <div
              className="lst-actions animate-in"
              style={{ '--i': 3 } as CSSProperties}
            >
              <a href="#install" className="btn btn-primary btn-md">
                <Terminal size={16} aria-hidden="true" />
                Install
              </a>
              <span className="lst-upvote">
                <UpvoteButton
                  serverId={server.id}
                  initialCount={server.upvotes || 0}
                />
              </span>
              {hasRepository && (
                <OutboundLink
                  href={server.url}
                  destinationType="github"
                  serverId={server.id}
                  target="_blank"
                  rel={repoLinkRel(!!server.isPremium, !!server.isOfficial)}
                  className="btn btn-secondary btn-sm"
                  aria-label={`${repoHost || 'Source'} repository`}
                >
                  <FolderGit2 size={15} aria-hidden="true" />
                  <span className="lst-btn-label">Repository</span>
                  {server.isOfficial && (
                    <BadgeCheck
                      size={14}
                      className="lst-accent-icon"
                      aria-label="Verified owner"
                    />
                  )}
                </OutboundLink>
              )}
              <AdminInlineLinkPopover
                serverId={server.id}
                type="repository"
                currentUrl={server.url}
              />
              {primaryWebsiteUrl && (
                <OutboundLink
                  href={primaryWebsiteUrl}
                  destinationType="website"
                  serverId={server.id}
                  target="_blank"
                  rel={websiteLinkRel(
                    !!server.isPremium,
                    !!server.websiteBacklinkOk,
                  )}
                  className="btn btn-secondary btn-sm"
                  aria-label="Website"
                >
                  <Globe size={15} aria-hidden="true" />
                  <span className="lst-btn-label">Website</span>
                  {server.websiteBacklinkOk ? (
                    <BadgeCheck
                      size={14}
                      className="lst-accent-icon"
                      aria-hidden="true"
                    />
                  ) : null}
                </OutboundLink>
              )}
              <AdminInlineLinkPopover
                serverId={server.id}
                type="website"
                // Edits the stored field, which can still be empty when
                // the button above fell back to server.url.
                currentUrl={server.websiteUrl || ''}
              />
              <ShareModal serverId={server.id} serverName={server.name} />
              <ListingMoreMenu>
                {server.supportUrl && (
                  <OutboundLink
                    href={server.supportUrl}
                    destinationType="website"
                    serverId={server.id}
                    target="_blank"
                    rel={supportLinkRel(
                      !!server.isPremium,
                      !!server.websiteBacklinkOk,
                      server.supportUrl,
                      server.websiteUrl,
                    )}
                    className="lst-menu-item"
                  >
                    <LifeBuoy size={15} aria-hidden="true" /> Get support
                  </OutboundLink>
                )}
                <Link
                  href={`/mcp/${server.id}/readme`}
                  rel="nofollow"
                  className="lst-menu-item"
                >
                  <FileText size={15} aria-hidden="true" /> Full README
                </Link>
                <Link
                  href={`/mcp/${server.id}/alternatives`}
                  rel="nofollow"
                  className="lst-menu-item"
                >
                  <Shuffle size={15} aria-hidden="true" /> Compare alternatives
                </Link>
                <Link
                  href={`/mcp/${server.id}/embed`}
                  rel="nofollow"
                  className="lst-menu-item"
                >
                  <Code2 size={15} aria-hidden="true" /> Embed widget
                </Link>
                <span className="lst-menu-sep" aria-hidden="true" />
                {!server.isOfficial && (
                  <Link
                    href={`/mcp/${server.id}/claim`}
                    className="lst-menu-item"
                  >
                    <BadgeCheck size={15} aria-hidden="true" /> Claim this
                    listing
                  </Link>
                )}
                <ReportListingButton serverId={server.id} />
              </ListingMoreMenu>
            </div>
          </header>

          <div className="lst-grid">
            {/* ── Main column ───────────────────────────────────────── */}
            <div className="lst-main">
              <ListingSectionNav sections={sections} />

              {/* Install is the hero: the one thing most visitors came for. */}
              <section
                id="install"
                className="lst-section lst-install"
                aria-labelledby="install-h"
              >
                <span id="quick-install" className="lst-anchor" />
                <div className="lst-install-head">
                  <div>
                    <h2 id="install-h">
                      <span className="lst-section-icon tint-tile hue-teal">
                        <Download size={16} aria-hidden="true" />
                      </span>
                      Install {displayName}
                    </h2>
                    <p>
                      Pick your client, then add it in one click or paste the
                      config.
                    </p>
                  </div>
                  {(detailTransport || detailRuntime) && (
                    <div className="lst-install-tags">
                      {detailTransport && (
                        <span className="lst-pill">{detailTransport}</span>
                      )}
                      {detailRuntime && (
                        <span className="lst-pill">{detailRuntime}</span>
                      )}
                    </div>
                  )}
                </div>

                <InstallPanel
                  server={server}
                  setupUrl={server.installNoteHref || server.url}
                  setupLabel={
                    hasRepository
                      ? `Open setup steps on ${repoHost || 'the repository'}`
                      : 'Open the project’s setup instructions'
                  }
                />

                {server.remoteEndpointUrl && (
                  <div className="lst-install-extra">
                    <div className="lst-install-extra-head">
                      <Globe size={14} aria-hidden="true" />
                      <span>Hosted endpoint</span>
                      {showRemoteHealth && (
                        <IconTooltip
                          label="Hosted endpoint health"
                          asSpan
                          trigger={
                            <span
                              className={`lst-health lst-health--${remoteHealthy ? 'active' : 'down'} ${statusHueClass(remoteHealthy ? 'ok' : 'bad')}`}
                            >
                              <span
                                className="lst-health-dot"
                                aria-hidden="true"
                              />
                              {remoteHealthy ? 'Live' : 'Unreachable'}
                              {formatCommitAge(server.remoteEndpointCheckedAt)
                                ? ` · ${formatCommitAge(server.remoteEndpointCheckedAt)}`
                                : ''}
                            </span>
                          }
                        >
                          <span className="mcp-icon-tooltip-title">
                            {remoteHealthy
                              ? 'Live Remote Endpoint'
                              : 'Remote Endpoint Unreachable'}
                          </span>
                          <span className="mcp-icon-tooltip-body">
                            {remoteHealthy
                              ? 'Our automated health check connected to this remote MCP endpoint successfully.'
                              : 'Our automated health check could not connect to this remote SSE endpoint.'}
                          </span>
                          <span className="mcp-icon-tooltip-meta">
                            {server.remoteEndpointCheckedAt
                              ? `Last checked ${new Date(server.remoteEndpointCheckedAt).toLocaleString()}`
                              : 'Live on-site API endpoint.'}
                          </span>
                        </IconTooltip>
                      )}
                    </div>
                    <p className="lst-muted-sm">
                      Clients with native remote MCP support can connect
                      directly to this URL.
                    </p>
                    <CopyBlock
                      className="copyblock--flush"
                      code={server.remoteEndpointUrl}
                      serverId={server.id}
                      title="Remote endpoint"
                      language="text"
                      snippetType="remote_endpoint_url"
                    />
                  </div>
                )}

                {(verification ||
                  (server.installKind === 'stdio' &&
                    server.installCommand)) && (
                  <div className="lst-install-extra lst-check">
                    {server.id === 'allmcps-server' ? (
                      <p className="lst-check-line">
                        <CheckCircle
                          size={15}
                          className="lst-ok"
                          aria-hidden="true"
                        />
                        <strong>Official flagship server</strong>
                        <span>
                          — maintained directly by AllMCPs. Fully verified to
                          search, introspect, and manage MCP tools
                          programmatically from your agent.
                        </span>
                      </p>
                    ) : !verification ? (
                      <p className="lst-check-line">
                        <Clock size={15} aria-hidden="true" />
                        <strong>Install not yet sandbox-tested</strong>
                        <span>
                          {hasIntrospectedTools
                            ? '— the server itself is confirmed live (we called its tools/list endpoint). The stdio install command is a separate, ongoing check.'
                            : "— we haven't run this command through our automated sandbox yet. Not a red flag; we're working through the catalog."}
                        </span>
                      </p>
                    ) : verification.status === 'ok' ? (
                      <p className="lst-check-line">
                        <Sparkles
                          size={15}
                          className="lst-ok"
                          aria-hidden="true"
                        />
                        <strong>Automated check passed</strong>
                        <span>
                          — started and listed {verification.toolCount ?? 'its'}{' '}
                          tools correctly
                          {formatCommitAge(verification.checkedAt)
                            ? ` (${formatCommitAge(verification.checkedAt)})`
                            : ''}
                          .
                        </span>
                      </p>
                    ) : (
                      <details className="lst-check-details">
                        <summary className="lst-check-line">
                          <Info size={15} aria-hidden="true" />
                          <strong>
                            We couldn&rsquo;t confirm it starts correctly
                          </strong>
                          <ChevronDown
                            size={14}
                            className="lst-chevron"
                            aria-hidden="true"
                          />
                        </summary>
                        <p className="lst-muted-sm">
                          {
                            {
                              needs_credentials:
                                'The install command installed and started the server, which then stopped for configuration (such as an API key) that our sandbox does not have — expected for servers that connect to your account.',
                              timeout:
                                "We ran the install command but it didn't respond within our test window — this can mean a slow first-time install rather than a real problem.",
                              handshake_failed:
                                "The install command started, but didn't respond the way we expected when we tried to talk to it.",
                              install_failed:
                                "The install command didn't complete successfully in our automated test.",
                              error:
                                'We hit an unexpected error while testing this listing automatically.',
                            }[verification.status]
                          }
                        </p>
                        <code className="lst-check-cmd">
                          {[
                            server.installCommand,
                            ...(parseArgsJson(server.installArgs) ?? []),
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        </code>
                        {verification.error && (
                          <p className="lst-check-error">
                            {verification.error}
                          </p>
                        )}
                        <p className="lst-muted-sm">
                          This is an experimental automated check and can have
                          false negatives — missing environment variables, a
                          slow cold install, etc. It doesn&rsquo;t necessarily
                          mean something&rsquo;s wrong.
                          {formatCommitAge(verification.checkedAt)
                            ? ` Last checked ${formatCommitAge(verification.checkedAt)}.`
                            : ''}{' '}
                          {!server.isOfficial && (
                            <ClaimHintLink serverId={server.id} />
                          )}
                        </p>
                      </details>
                    )}
                  </div>
                )}
              </section>

              <ReviewNudge serverId={server.id} serverName={displayName} />

              {/* ── Overview ──────────────────────────────────────── */}
              <section
                id="overview"
                className="lst-section reveal"
                aria-labelledby="overview-h"
              >
                <header className="lst-section-head">
                  <h2 id="overview-h">
                    <span className="lst-section-icon tint-tile hue-blue">
                      <BookOpen size={16} aria-hidden="true" />
                    </span>
                    Overview
                  </h2>
                </header>

                {server.tags && server.tags.length > 0 && (
                  <ul className="lst-tags" aria-label="Tags">
                    {server.tags.map((tag) => (
                      <li key={tag} className="lst-tag">
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}

                {server.id === 'allmcps-server' && (
                  <FlagshipHeroBanner
                    serverId={server.id}
                    serverName={displayName}
                    toolCount={toolCount}
                  />
                )}

                {server.aiOverview && (
                  <div className="lst-lead">
                    <CollapsibleText collapsedLines={5}>
                      <p>{server.aiOverview}</p>
                    </CollapsibleText>
                  </div>
                )}

                {hasAiOverview &&
                  ((server.aiUseCases?.length ?? 0) > 0 ||
                    (server.aiFeatures?.length ?? 0) > 0) && (
                    <div className="lst-two-up">
                      {(server.aiUseCases?.length ?? 0) > 0 && (
                        <div className="lst-card">
                          <h3 className="lst-card-title">Use cases</h3>
                          <ul className="lst-bullets">
                            {server.aiUseCases?.map((uc) => (
                              <li key={uc}>{uc}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(server.aiFeatures?.length ?? 0) > 0 && (
                        <div className="lst-card">
                          <h3 className="lst-card-title">Key features</h3>
                          <ul className="lst-bullets">
                            {server.aiFeatures?.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                {server.screenshotUrl && (
                  <ScreenshotViewer
                    src={server.screenshotUrl}
                    alt={`${displayName} screenshot`}
                    title={`${displayName} Screenshot`}
                  />
                )}
              </section>

              {/* ── Tools ─────────────────────────────────────────── */}
              {toolCount > 0 && (
                <section
                  id="tools-schema"
                  className="lst-section reveal"
                  aria-labelledby="tools-h"
                >
                  <header className="lst-section-head">
                    <h2 id="tools-h">
                      <span className="lst-section-icon tint-tile hue-violet">
                        <Wrench size={16} aria-hidden="true" />
                      </span>
                      Tools
                      <span className="lst-section-count">{toolCount}</span>
                    </h2>
                    <p>
                      What {displayName} lets your agent do. Expand a tool for
                      its parameters.
                    </p>
                  </header>
                  <ToolSchemaInspector
                    tools={server.tools}
                    toolsSource={server.toolsSource}
                  />
                </section>
              )}

              {/* ── Security & health ─────────────────────────────── */}
              <section
                id="security"
                className="lst-section reveal"
                aria-labelledby="security-h"
              >
                <header className="lst-section-head">
                  <h2 id="security-h">
                    <span className="lst-section-icon tint-tile hue-indigo">
                      <ShieldCheck size={16} aria-hidden="true" />
                    </span>
                    Security &amp; health
                  </h2>
                  <p>
                    What it can reach and how reliably it runs — from our own
                    checks, not the maintainer&rsquo;s claims.
                  </p>
                </header>

                <div className="lst-card lst-health-card">
                  <div className="lst-health-row">
                    <span
                      className={`lst-health lst-health--${healthKey} ${healthUi.tone}`}
                    >
                      <span className="lst-health-dot" aria-hidden="true" />
                      {healthUi.label.replace('Health: ', '')}
                    </span>
                    <span className="lst-muted-sm">
                      {server.lastCheckedAt
                        ? `Last checked ${formatCommitAge(server.lastCheckedAt) ?? new Date(server.lastCheckedAt).toLocaleDateString()}`
                        : 'No health check has run yet.'}
                    </span>
                  </div>
                  <p className="lst-muted-sm">{healthUi.detail}</p>
                  <HealthHistoryStrip
                    history={healthHistory}
                    verification={verification}
                    hasRemoteEndpoint={!!server.remoteEndpointUrl}
                    isOfficial={
                      server.isOfficial || server.id === 'allmcps-server'
                    }
                  />
                </div>

                {(hasSecurityCard || hasVulnCard) && (
                  <div className="lst-two-up">
                    <SecurityProfileCard server={serverWithSignals} />
                    <VulnSignalCard server={server} />
                  </div>
                )}

                <AdoptionSignals
                  githubStars={server.githubStars}
                  npmDownloads={server.npmDownloads}
                  lastCommitAt={server.lastCommitAt}
                  maintenanceStatus={server.maintenanceStatus}
                  availabilityPct={combinedAvailabilityPct}
                  installCheck={verification?.status ?? null}
                  toolCount={server.tools?.length ?? null}
                  views={publicViewCount(server)}
                  copies={server.copies}
                  upvotes={server.upvotes}
                />
              </section>

              {/* ── How it works ──────────────────────────────────── */}
              {/* Below our own verified data (tools, health, security) on
                  purpose: what we checked first-hand is what this page offers
                  that the upstream repo doesn't, so it leads; the written
                  walkthrough supports it. */}
              <section
                id="how-it-works"
                className="lst-section reveal"
                aria-label={`How ${displayName} works`}
              >
                <div id="overview-doc" className="lst-doc">
                  {(server.aiDoc?.trim() || readme) && (
                    <h3 className="lst-doc-title">
                      {server.aiDoc?.trim()
                        ? `How ${displayName} works`
                        : 'From the project README'}
                    </h3>
                  )}
                  <ExpandableDoc>
                    <div className="markdown-body">
                      {server.aiDoc?.trim() ? (
                        // Our own restructured writeup — original prose grounded in
                        // the README, not a mirror of it. The full upstream README
                        // is one click away at the noindex /mcp/[id]/readme route.
                        <SafeMarkdown
                          content={server.aiDoc}
                          utmContent={server.id}
                          repoUrl={server.url}
                        />
                      ) : readme ? (
                        // Fallback until the enrich cron writes this listing's
                        // writeup: show the README excerpt as before rather than
                        // leave the page thin in the interim.
                        <SafeMarkdown
                          content={
                            truncateReadmeExcerpt(readme).excerpt ?? readme
                          }
                          utmContent={server.id}
                          repoUrl={server.url}
                        />
                      ) : (
                        <>
                          <p>
                            {displayName} is a {server.category} MCP server
                            {org ? ` from ${org}` : ''} listed on AllMCPs.{' '}
                            {server.description}
                          </p>
                          {!hasSuppliedDescription && (
                            <p>
                              We couldn&rsquo;t automatically pull a README for
                              this listing
                              {repoHost ? ` from ${repoHost}` : ''}, so the
                              summary above comes from its listing details. Use
                              the config in <a href="#install">Install</a>{' '}
                              above, then open the source repository for full
                              setup instructions and the tools it exposes over
                              MCP.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </ExpandableDoc>
                  <p className="lst-doc-links">
                    <Link
                      href={`/mcp/${server.id}/readme`}
                      rel="nofollow"
                      className="link-arrow"
                    >
                      Read the full README <ArrowRight size={14} />
                    </Link>
                    {hasRepository && (
                      <OutboundLink
                        href={server.url}
                        destinationType="github"
                        serverId={server.id}
                        target="_blank"
                        rel={repoLinkRel(
                          !!server.isPremium,
                          !!server.isOfficial,
                        )}
                        className="link-arrow"
                      >
                        View source on {repoHost || 'the source repository'}{' '}
                        <ExternalLink size={13} />
                      </OutboundLink>
                    )}
                  </p>
                </div>
              </section>

              <ReviewsSection serverId={server.id} summary={reviewSummary} />

              {/* Query-forward AEO / FAQ block */}
              <section id="faq" className="lst-section reveal">
                <FaqSection
                  renderJsonLd={false}
                  className="lst-faq"
                  title={`Frequently Asked Questions about ${displayName}`}
                  items={faqItems.map((item) => ({
                    question: item.q,
                    answer: item.a,
                  }))}
                />
              </section>

              {/* ── Alternatives ──────────────────────────────────── */}
              {hasRelated && (
                <section
                  id="alternatives"
                  className="lst-section reveal"
                  aria-labelledby="alternatives-h"
                >
                  <header className="lst-section-head lst-section-head--split">
                    <h2 id="alternatives-h">
                      <span className={`lst-section-icon tint-tile ${catHue}`}>
                        <Shuffle size={16} aria-hidden="true" />
                      </span>
                      Related MCP servers
                    </h2>
                    <div className="lst-section-links">
                      <Link
                        href={`/categories/${catSlug}`}
                        className="link-arrow"
                      >
                        All in {catMeta.label} <ArrowRight size={14} />
                      </Link>
                      <Link
                        href={`/mcp/${server.id}/alternatives`}
                        rel="nofollow"
                        className="link-arrow"
                      >
                        All alternatives <ArrowRight size={14} />
                      </Link>
                    </div>
                  </header>
                  <ul className="lst-related reveal-stagger">
                    {relatedServers.map((rel, i) => {
                      const relName = parseServerName(rel.name).displayName;
                      const featured = isFeaturedListing(rel as any);
                      return (
                        <li
                          key={rel.id}
                          className={`lst-related-card spotlight tint-card ${categoryHueClass(rel.category)}${featured ? ' is-featured' : ''}`}
                          style={{ '--i': i } as CSSProperties}
                        >
                          <Link
                            href={`/mcp/${rel.id}`}
                            className="lst-related-main"
                          >
                            <span className="lst-related-top">
                              <ServerAvatar
                                name={rel.name}
                                logoUrl={rel.logoUrl}
                                category={rel.category}
                                size={32}
                              />
                              <span className="lst-related-name">
                                {relName}
                              </span>
                              {featured ? (
                                <span className="lst-pill lst-pill--accent">
                                  Featured
                                </span>
                              ) : rel.isOfficial ? (
                                <span className="lst-pill lst-pill--accent">
                                  Verified
                                </span>
                              ) : null}
                            </span>
                            <span className="lst-related-desc">
                              <SafeMarkdown
                                content={
                                  rel.description || 'No description provided.'
                                }
                                isInline
                              />
                            </span>
                            <span className="lst-related-foot">
                              <span className="tint-pill">
                                {getCategoryMeta(rel.category).label}
                              </span>
                              <span className="tabular">
                                {formatCompactNumber(publicViewCount(rel))}{' '}
                                views
                              </span>
                            </span>
                          </Link>
                          <Link
                            href={`/mcp/${server.id}/vs/${rel.id}`}
                            rel="nofollow"
                            className="lst-related-compare"
                          >
                            Compare vs {relName}
                            <ArrowRight size={13} aria-hidden="true" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <details className="lst-card lst-badge">
                <summary>
                  <span>
                    <span className="lst-side-title">
                      Add a badge to your README
                    </span>
                    <span className="lst-muted-sm">
                      Show it&rsquo;s listed — live SVG, Markdown or HTML.
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className="lst-chevron"
                    aria-hidden="true"
                  />
                </summary>
                <div className="lst-badge-body">
                  <DirectoryBadgeCard
                    serverId={server.id}
                    serverName={displayName}
                  />
                </div>
              </details>
            </div>

            {/* ── Sidebar ───────────────────────────────────────────── */}
            <aside className="lst-side" aria-label="Listing details">
              {/* Sponsored units first, so they're above the fold beside the
                  install panel (impressions count at ≥50% visible). */}
              <div className="lst-sponsored">
                <SponsorAdUnit placement="detail_sidebar" />
                {/* A paid featured listing (see spotlightPick); the upsell only when none. */}
                {spotlightPick ? (
                  <ImpressionBeacon
                    serverId={spotlightPick.id}
                    surface="detail_sidebar"
                  >
                    <Link
                      href={`/mcp/${spotlightPick.id}`}
                      className="lst-card lst-promo"
                    >
                      <span className="lst-promo-label">Featured</span>
                      <span className="lst-promo-top">
                        <ServerAvatar
                          name={spotlightPick.name}
                          logoUrl={spotlightPick.logoUrl}
                          size={28}
                        />
                        <span className="lst-promo-name">
                          {parseServerName(spotlightPick.name).displayName}
                        </span>
                      </span>
                      <span className="lst-promo-desc">
                        <SafeMarkdown
                          content={
                            spotlightPick.description ||
                            'No description provided.'
                          }
                          isInline
                        />
                      </span>
                      <span className="link-arrow">
                        Explore server <ArrowRight size={13} />
                      </span>
                    </Link>
                  </ImpressionBeacon>
                ) : (
                  <Link href="/submit" className="lst-card lst-promo">
                    <span className="lst-promo-label">Spotlight slot</span>
                    <span className="lst-promo-name">
                      Feature your MCP server here
                    </span>
                    <span className="lst-promo-desc">
                      Get visibility across our directory, search results, and
                      detail pages.
                    </span>
                    <span className="link-arrow">
                      Spotlight your server <ArrowRight size={13} />
                    </span>
                  </Link>
                )}
              </div>

              <div className="lst-card lst-glance">
                <h2 className="lst-side-title">At a glance</h2>
                <dl className="lst-specs">
                  <div>
                    <dt>Category</dt>
                    <dd>
                      <Link
                        href={`/categories/${catSlug}`}
                        className={`lst-cat-link ${catHue}`}
                      >
                        <span className="lst-cat-dot" aria-hidden="true" />
                        <span aria-hidden="true">{catMeta.emoji}</span>{' '}
                        {catMeta.label}
                      </Link>
                    </dd>
                  </div>
                  {/* Transport and runtime are only stated when they come out of
                  a confirmed install — the same bar the install panel uses. On
                  a hosted listing with no published command, a derived guess
                  produced two confident, wrong rows. */}
                  {detailTransport && (
                    <div>
                      <dt>Transport</dt>
                      <dd>{detailTransport}</dd>
                    </div>
                  )}
                  {detailRuntime && (
                    <div>
                      <dt>Runtime</dt>
                      <dd>{detailRuntime}</dd>
                    </div>
                  )}
                  {server.authType && (
                    <div>
                      <dt>Auth</dt>
                      <dd>
                        {AUTH_TYPE_LABELS[server.authType as AuthType] ||
                          server.authType}
                      </dd>
                    </div>
                  )}
                  {server.pricingModel && (
                    <div>
                      <dt>Pricing</dt>
                      <dd>
                        {PRICING_MODEL_LABELS[
                          server.pricingModel as PricingModel
                        ] || server.pricingModel}
                        {server.pricingNotes ? (
                          <span className="lst-specs-note">
                            {server.pricingNotes}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  )}
                  {server.license && (
                    <div>
                      <dt>License</dt>
                      <dd>{server.license}</dd>
                    </div>
                  )}
                  {server.maintenanceStatus && (
                    <div>
                      <dt>Maintenance</dt>
                      <dd>
                        {MAINTENANCE_STATUS_LABELS[
                          server.maintenanceStatus as MaintenanceStatus
                        ] || server.maintenanceStatus}
                      </dd>
                    </div>
                  )}
                  {server.compatibleClients &&
                    server.compatibleClients.length > 0 && (
                      <div>
                        <dt>Clients</dt>
                        <dd>
                          {server.compatibleClients
                            .map(
                              (slug) =>
                                MCP_CLIENTS.find((c) => c.slug === slug)
                                  ?.name || slug,
                            )
                            .join(', ')}
                        </dd>
                      </div>
                    )}
                  {contentUpdatedLabel && (
                    <div>
                      <dt>Last updated</dt>
                      <dd>{contentUpdatedLabel}</dd>
                    </div>
                  )}
                </dl>

                {/* Popularity — 2-up grid reads faster than one row each. */}
                <div className="detail-stats-grid">
                  <ViewTracker
                    serverId={server.id}
                    initialCount={publicViewCount(server)}
                  />
                  <InstallsStat count={server.copies || 0} />
                  {typeof server.githubStars === 'number' && (
                    <div className="detail-stat-item">
                      <span className="detail-stat-item-label">
                        <Star size={12} aria-hidden="true" /> GitHub stars
                      </span>
                      <span className="detail-stat-item-value">
                        {server.githubStars.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {formatCommitAge(server.lastCommitAt) && (
                    <div
                      className="detail-stat-item"
                      title={
                        formatFullDate(server.lastCommitAt)
                          ? `Last commit on ${formatFullDate(server.lastCommitAt)}`
                          : undefined
                      }
                    >
                      <span className="detail-stat-item-label">
                        <Clock size={12} aria-hidden="true" /> Last commit
                      </span>
                      <span className="detail-stat-item-value">
                        {formatCommitAge(server.lastCommitAt)}
                      </span>
                    </div>
                  )}
                  {typeof server.npmDownloads === 'number' && (
                    <div className="detail-stat-item">
                      <span className="detail-stat-item-label">
                        <Download size={12} aria-hidden="true" /> npm / month
                      </span>
                      <span className="detail-stat-item-value">
                        {server.npmDownloads.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="lst-glance-quality">
                  <QualityBadge server={serverForScoring} />
                </div>

                <ul className="lst-glance-links">
                  {hasRepository && (
                    <li>
                      <OutboundLink
                        href={server.url}
                        destinationType="github"
                        serverId={server.id}
                        target="_blank"
                        rel={repoLinkRel(
                          !!server.isPremium,
                          !!server.isOfficial,
                        )}
                      >
                        <FolderGit2 size={14} aria-hidden="true" />
                        <span>{repoHost || 'Repository'}</span>
                        <ExternalLink size={12} aria-hidden="true" />
                      </OutboundLink>
                    </li>
                  )}
                  {primaryWebsiteUrl && (
                    <li>
                      <OutboundLink
                        href={primaryWebsiteUrl}
                        destinationType="website"
                        serverId={server.id}
                        target="_blank"
                        rel={websiteLinkRel(
                          !!server.isPremium,
                          !!server.websiteBacklinkOk,
                        )}
                      >
                        <Globe size={14} aria-hidden="true" />
                        <span>Website</span>
                        <ExternalLink size={12} aria-hidden="true" />
                      </OutboundLink>
                    </li>
                  )}
                  <li>
                    <Link href={`/mcp/${server.id}/readme`} rel="nofollow">
                      <FileText size={14} aria-hidden="true" />
                      <span>Full README</span>
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </li>
                </ul>
              </div>

              {!server.isOfficial && (
                <div className="lst-card lst-claim">
                  <h2 className="lst-side-title">
                    <BadgeCheck size={16} aria-hidden="true" /> Own this
                    project?
                  </h2>
                  <p>
                    This listing is pre-filled from public sources. Claim it via
                    your GitHub README, a site badge, or DNS TXT to edit it and
                    earn the Verified badge
                    {server.websiteUrl ? '' : ' (and attach your website)'}.
                  </p>
                  <p className="lst-claim-perk">
                    <strong>Free dofollow backlink:</strong> add your website
                    and place the AllMCPs badge on it — no claim needed. We
                    detect it automatically.
                  </p>
                  <Link
                    href={`/mcp/${server.id}/claim`}
                    className="btn btn-secondary btn-sm lst-block-btn"
                  >
                    Claim this listing <ArrowRight size={14} />
                  </Link>
                </div>
              )}

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

              {/* Internal SEO mesh — category, best-of, install guides, alternatives */}
              <nav className="lst-card lst-explore" aria-label="Explore more">
                <h2 className="lst-side-title">Explore more</h2>
                <ul>
                  <li>
                    <Link href={`/categories/${catSlug}`}>
                      More in {server.category}
                    </Link>
                  </li>
                  {best && (
                    <li>
                      <Link href={`/best/${best.slug}`}>
                        Best MCP servers for {best.title}
                      </Link>
                    </li>
                  )}
                  {keywordHubs.map((t) => (
                    <li key={t.slug}>
                      <Link href={`/best/${t.slug}`}>
                        Best {t.title} MCP servers
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      href={`/mcp/${server.id}/alternatives`}
                      rel="nofollow"
                    >
                      Alternatives to {displayName}
                    </Link>
                  </li>
                </ul>
                <ul className="lst-explore-secondary">
                  <li>
                    <Link href="/clients/claude-desktop">
                      Install in Claude Desktop
                    </Link>
                  </li>
                  <li>
                    <Link href="/clients/cursor">Install in Cursor</Link>
                  </li>
                  <li>
                    <Link href="/clients/vs-code">Install in VS Code</Link>
                  </li>
                  <li>
                    <Link href="/clients">
                      Setup guides for all {MCP_CLIENTS.length} MCP clients
                    </Link>
                  </li>
                </ul>
              </nav>
            </aside>
          </div>
        </main>
        <MobileInstallBar displayName={displayName} subtitle={categoryLabel} />
      </AdminProvider>
    </>
  );
}
