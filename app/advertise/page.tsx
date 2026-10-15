import {
  ArrowRight,
  Bot,
  Check,
  Eye,
  FileCode2,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type React from 'react';
import { PlacementShowcase } from '../../components/ads/PlacementShowcase';
import { PageShell } from '../../components/PageShell';
import { FaqSection } from '../../components/ui/FaqSection';
import { CPM_TIERS, formatUsdAmount } from '../../lib/ads';
import type { Hue } from '../../lib/palette';
import { getSiteStats } from '../../lib/siteStats';

/** Delivery-tier identity hues (check marks on the tier cards). */
const CPM_TIER_HUE: Record<string, Hue> = {
  standard: 'teal',
  growth: 'violet',
  blitz: 'orange',
};

// Same root cause app/trust/page.tsx documents (see lib/siteStats.ts's getSiteStats):
// D1 isn't reachable during build, so baking live stats into an ISR/static page
// freezes them to a zeroed build-time fallback. This page advertises "verifiable
// metrics" to paying sponsors, so it renders per-request against live D1 instead.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Advertise on AllMCPs — Sponsor the MCP Directory',
  description:
    'Sponsor AllMCPs with logo and copy ads across the MCP server directory, search results, and our MCP server. Transparent CPM pricing, every ad reviewed by hand.',
  alternates: {
    canonical: 'https://allmcps.com/advertise',
  },
  openGraph: {
    title: 'Advertise on AllMCPs — Sponsor the MCP Directory',
    description:
      'Sponsor AllMCPs with logo and copy ads across the MCP server directory, search results, and our MCP server.',
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    url: 'https://allmcps.com/advertise',
  },
};

const AD_FAQS = [
  {
    q: 'Do I need to buy each placement separately?',
    a: 'No! All 4 website placements and AI agent query feeds are included automatically with every campaign. Your ad rotates seamlessly across directory listings, tool inspector sidebars, category headers, guide tutorials, and MCP protocol responses — you simply choose how many impressions you want.',
  },
  {
    q: 'Who visits AllMCPs?',
    a: 'Our audience consists of software engineers, AI researchers, tech founders, and developers building autonomous agents and integrating Model Context Protocol servers into Cursor, Claude Desktop, Windsurf, and VS Code.',
  },
  {
    q: 'How does the 1,000-impression block model work?',
    a: 'You purchase impression credits in blocks of 1,000. You choose your CPM bid ($5 standard, $10 growth, or $20 blitz). When more than one campaign is live, a higher bid wins a proportionally bigger share of the rotation (Growth has 2x and Blitz 4x the weight of Standard). There is no end date: your campaign keeps running until every purchased impression is delivered.',
  },
  {
    q: 'What types of tools, products, or sites are allowed to advertise?',
    a: 'Almost anything that software engineers, developers, AI builders, or tech-focused professionals would find useful and relevant! This includes developer tools, APIs, SaaS platforms, cloud infrastructure, AI models, hardware, newsletters, tech events, and open-source projects. We strictly disallow adult content, gambling, predatory financial services, deceptive links, or malicious software. If we reject a paid campaign for any reason, a full refund is issued to your original payment method automatically.',
  },
  {
    q: 'What analytics and reporting do I get?',
    a: 'Every campaign includes a real-time live reporting dashboard where you can monitor impressions delivered, clicks, click-through rate (CTR), and daily delivery pace.',
  },
  {
    q: 'How long does review take after submitting?',
    a: 'Every campaign is reviewed by hand before it runs, and we aim to review within 24 hours. As soon as your campaign is approved and payment confirmed, it immediately enters live rotation.',
  },
];

const AI_SAMPLE = `// tools/call search_mcp_servers { "query": "vector database" }
"content": [
  { "type": "text", "text": "...matching servers..." },
  {
    "type": "text",
    "text": "Sponsored: VectorDB Pro — Lightning-fast vector search for agents (https://example.com)",
    "annotations": { "audience": ["user"], "priority": 0.1 }
  }
]`;

const TIER_EXTRA: Record<string, string> = {
  standard: 'Steady rotation across all spots',
  growth: '2x the rotation weight of Standard',
  blitz: '4x the rotation weight of Standard',
};

/** Compact number for the audience strip (80.4M, 12.3K). */
function compact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export default async function AdvertiseLandingPage() {
  const stats = await getSiteStats();
  const monthlyApiRequests = stats.endpointBreakdown30d.reduce(
    (acc, e) => acc + e.hits,
    0,
  );

  // Only show audience numbers that are big enough to mean something — a
  // "1+ monthly requests" tile undersells the page it is meant to sell.
  const audience = [
    {
      value: compact(stats.totalServers),
      label: 'MCP servers listed',
      note: `Across ${stats.categoryCount} categories`,
      show: stats.totalServers > 0,
    },
    {
      value: compact(stats.totalViews),
      label: 'Listing views',
      note: 'All-time listing page views',
      show: stats.totalViews >= 1000,
    },
    {
      value: compact(monthlyApiRequests),
      label: 'API requests / 30d',
      note: 'API, Markdown, MCP & llms.txt — all callers',
      show: monthlyApiRequests >= 1000,
    },
    {
      value: compact(stats.aiReads30d),
      label: 'AI system reads / 30d',
      note: 'Named AI assistants & AI crawlers',
      show: stats.aiReads30d >= 1000,
    },
  ].filter((s) => s.show);

  return (
    <PageShell variant="default" className="acct-adv">
      <header className="acct-adv-hero">
        <h1
          className="text-page-title acct-adv-title animate-in"
          style={{ '--i': 1 } as React.CSSProperties}
        >
          Advertise on the MCP server directory
        </h1>
        <p
          className="text-lead acct-adv-lead animate-in"
          style={{ '--i': 2 } as React.CSSProperties}
        >
          One campaign runs across <strong>every AllMCPs placement</strong> and
          our AI agent feeds. Pick an impression volume — it runs until every
          impression is delivered, and reporting is live.
        </p>
        <div
          className="acct-adv-cta animate-in"
          style={{ '--i': 3 } as React.CSSProperties}
        >
          <Link href="/advertise/create" className="btn btn-primary btn-lg">
            Create a campaign
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <a href="#placements" className="btn btn-secondary btn-lg">
            See placements
          </a>
        </div>
        <p
          className="acct-adv-fine animate-in"
          style={{ '--i': 4 } as React.CSSProperties}
        >
          From {formatUsdAmount(CPM_TIERS[0].cpmCents)} per 1,000 views · Full
          refund if a campaign is rejected
        </p>
      </header>

      {audience.length > 0 ? (
        <section className="acct-adv-audience" aria-label="Audience">
          <ul>
            {audience.map((a) => (
              <li key={a.label}>
                <strong className="tabular">{a.value}</strong>
                <span className="acct-adv-audience-label">{a.label}</span>
                <span className="acct-adv-audience-note">{a.note}</span>
              </li>
            ))}
          </ul>
          <Link href="/trust" className="acct-adv-audience-trust">
            <ShieldCheck size={15} aria-hidden="true" />
            Every number is live — audit it on our trust dashboard
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <section
        className="section-tight acct-adv-steps"
        aria-label="How it works"
      >
        <ol>
          <li>
            <span className="acct-adv-step-icon hue-blue" aria-hidden="true">
              <FileCode2 size={18} />
            </span>
            <h2>Write your ad</h2>
            <p>Logo, headline, one line of copy and a link. Preview it live.</p>
          </li>
          <li>
            <span className="acct-adv-step-icon hue-violet" aria-hidden="true">
              <Layers size={18} />
            </span>
            <h2>Choose volume &amp; speed</h2>
            <p>
              Buy impressions in 1,000-view blocks at the delivery tier you
              want.
            </p>
          </li>
          <li>
            <span className="acct-adv-step-icon hue-orange" aria-hidden="true">
              <Eye size={18} />
            </span>
            <h2>Go live &amp; track</h2>
            <p>Reviewed by hand, then live with real-time CTR reporting.</p>
          </li>
        </ol>
      </section>

      <section id="placements" className="section-tight acct-adv-section">
        <div className="section-head section-head--center">
          <h2 className="section-title">Every placement, one campaign</h2>
          <p className="section-sub">
            No per-spot setup. Your ad rotates across directory listings, tool
            sidebars, category headers, guides and AI protocol responses.
          </p>
        </div>
        <PlacementShowcase />
      </section>

      <section className="section-tight acct-adv-ai">
        <div className="acct-adv-ai-copy">
          <h2>Shown inside AI coding assistants</h2>
          <p>
            When developers search our MCP server from Cursor, Claude Desktop,
            Windsurf or their own agents, search responses can carry a short,
            clearly labelled sponsor line for your product.
          </p>
          <ul className="acct-tier-list">
            <li>
              <Check size={15} aria-hidden="true" />
              <span>
                <strong>No impression cost.</strong> Credits are only spent on
                web views where at least half the ad is on screen.
              </span>
            </li>
            <li>
              <Check size={15} aria-hidden="true" />
              <span>
                <strong>Clearly labelled.</strong> A separate
                &ldquo;Sponsored&rdquo; line after the results, never mixed into
                them.
              </span>
            </li>
            <li>
              <Check size={15} aria-hidden="true" />
              <span>
                <strong>Machine-readable.</strong> Included in our MCP search
                responses and the <code>/api/v1/search</code> feed.
              </span>
            </li>
          </ul>
        </div>
        <figure className="acct-terminal">
          <figcaption className="acct-terminal-bar">
            <Bot size={14} aria-hidden="true" />
            MCP response · Cursor / Claude
          </figcaption>
          <pre>{AI_SAMPLE}</pre>
        </figure>
      </section>

      <section className="section-tight" aria-labelledby="adv-pricing">
        <div className="section-head section-head--center">
          <h2 id="adv-pricing" className="section-title">
            Pick your delivery speed
          </h2>
          <p className="section-sub">
            Every tier includes all placements and AI feeds. Higher tiers win a
            bigger share of the rotation when several campaigns are live.
            Minimum 1,000 impressions.
          </p>
        </div>

        <div className="acct-tiers">
          {CPM_TIERS.map((tier) => {
            const isFeatured = tier.id === 'growth';
            const tierHue = CPM_TIER_HUE[tier.id] ?? 'teal';
            return (
              <article
                key={tier.id}
                className={`acct-tier hue-${tierHue}${isFeatured ? ' acct-tier--featured' : ''}`}
              >
                {isFeatured ? (
                  <span className="acct-tier-flag">Recommended</span>
                ) : null}
                <header>
                  <p className="acct-tier-kicker">
                    {tier.badge} · {tier.weightMultiplier}x weight
                  </p>
                  <h3 className="acct-tier-name">{tier.label}</h3>
                  <p className="acct-tier-tagline">{tier.tagline}</p>
                </header>
                <p className="acct-tier-price">
                  <span className="tabular">
                    {formatUsdAmount(tier.cpmCents)}
                  </span>
                  <span className="acct-tier-per">/ 1k impressions</span>
                </p>
                <Link
                  href={`/advertise/create?tier=${tier.id}`}
                  className={`btn btn-md btn-full ${isFeatured ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Choose {tier.label}
                </Link>
                <ul className="acct-tier-list">
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>All placements &amp; AI queries included</span>
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>1,000 impression minimum</span>
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>Real-time CTR &amp; clicks dashboard</span>
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>{TIER_EXTRA[tier.id]}</span>
                  </li>
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-tight">
        <div className="section-head section-head--center">
          <h2 className="section-title">Questions, answered</h2>
        </div>
        <div className="acct-faq">
          <FaqSection items={AD_FAQS} />
        </div>
      </section>

      <div className="acct-final-cta">
        <h2>Launch your first campaign in minutes</h2>
        <p>Write it, preview it in every placement, and pay only for views.</p>
        <div className="acct-final-cta-actions">
          <Link href="/advertise/create" className="btn btn-primary btn-lg">
            Open the campaign studio
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
