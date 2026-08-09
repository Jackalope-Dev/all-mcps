import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Tag,
  ShieldCheck,
  Eye,
  Copy,
  ThumbsUp,
  Bot,
  Search,
  Users,
  HelpCircle,
  MessageSquare,
  Lock,
  Globe,
  Activity,
  Radio,
  Wrench,
  Award,
  Terminal,
  CheckCircle2,
  GitCommit,
  PieChart,
  Sparkles,
} from 'lucide-react';
import { getSiteStats, AI_SYSTEM_CLASSES } from '../../lib/siteStats';
import { CALLER_COLORS } from '../../lib/accessLog';
import type { CallerBreakdown, EndpointBreakdown, CountryBreakdown } from '../../lib/siteStats';
import { TrendChart } from '../../components/TrustCharts';

export const metadata: Metadata = {
  title: 'Trust & Traffic Transparency | AllMCPs',
  description:
    'Live, unfiltered numbers on how people and AI systems actually use AllMCPs: site visits, install activity, and a full breakdown of every AI assistant and crawler that reads the directory.',
  alternates: { canonical: 'https://allmcps.com/trust' },
  openGraph: {
    title: 'Trust & Traffic Transparency | AllMCPs',
    description:
      'Live, unfiltered numbers on how people and AI systems actually use AllMCPs.',
    url: 'https://allmcps.com/trust',
  },
};

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  const p = (part / total) * 100;
  return `${p < 0.1 && p > 0 ? '<0.1' : p.toFixed(1)}%`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return formatNumber(n);
}

/** Two-letter country code → flag emoji, via the regional-indicator Unicode trick. */
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '\u{1F3F3}\u{FE0F}';
  const upper = code.toUpperCase();
  return String.fromCodePoint(...[...upper].map((c) => 127397 + c.charCodeAt(0)));
}

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  try {
    if (!regionNames) regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

const GROUP_ICON: Record<string, typeof Bot> = {
  ai: Bot,
  crawler: Search,
  browser: Users,
  unknown: HelpCircle,
};

const TIER_COLORS: Record<string, string> = {
  Excellent: '#10b981',
  Great: '#22d3ee',
  Good: '#f59e0b',
  Fair: '#94a3b8',
  Emerging: '#8b9bb4',
};

function StatTile({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: typeof Cpu;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: 14,
        border: '1px solid var(--border-color)',
        background: 'var(--bg-muted)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 9,
          background: `${color}1f`,
        }}
      >
        <Icon size={16} style={{ color }} />
      </span>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({
  title,
  note,
  icon: Icon,
  tight,
}: {
  title: string;
  note: string;
  icon?: typeof Cpu;
  tight?: boolean;
}) {
  return (
    <div style={{ margin: tight ? '0 0 0.75rem' : '2.25rem 0 0.75rem' }}>
      <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {Icon && <Icon size={17} style={{ color: 'var(--brand-cyan)' }} />}
        {title}
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{note}</p>
    </div>
  );
}

/** Bordered card used to give each dense visualization block its own contained surface. */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        background: 'var(--card-bg)',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}
    >
      {children}
    </div>
  );
}

type TrafficGroup = {
  key: string;
  label: string;
  hits: number;
  colorVar: string;
  ink: string;
};

/** Part-to-whole stacked bar for the top-level traffic split, plus a legend with exact counts. */
function TrafficStackedBar({ groups, total }: { groups: TrafficGroup[]; total: number }) {
  if (total <= 0 || groups.length === 0) return null;

  return (
    <div className="trust-viz" style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          gap: 2,
          height: 22,
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--bg-muted)',
        }}
      >
        {groups.map((g) => {
          const widthPct = (g.hits / total) * 100;
          const showLabel = widthPct >= 12;
          return (
            <div
              key={g.key}
              title={`${g.label}: ${formatNumber(g.hits)} (${pct(g.hits, total)})`}
              style={{
                width: `${Math.max(widthPct, 1)}%`,
                background: `var(${g.colorVar})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showLabel && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: g.ink }}>
                  {pct(g.hits, total)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ul
        style={{
          listStyle: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1.25rem',
          margin: '0.65rem 0 0',
          padding: 0,
        }}
      >
        {groups.map((g) => (
          <li
            key={g.key}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: `var(${g.colorVar})`, flexShrink: 0 }} />
            {g.label}: {formatNumber(g.hits)} ({pct(g.hits, total)})
          </li>
        ))}
      </ul>
    </div>
  );
}

function Group({
  title,
  description,
  rows,
  totalHits,
  icon: Icon,
  iconColor,
}: {
  title: string;
  description: string;
  rows: CallerBreakdown[];
  totalHits: number;
  icon: typeof Bot;
  iconColor: string;
}) {
  if (rows.length === 0) return null;
  const groupTotal = rows.reduce((acc, r) => acc + r.hits, 0);

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon size={15} style={{ color: iconColor }} />
          <h3 style={{ fontSize: '1rem', margin: 0 }}>{title}</h3>
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {formatNumber(groupTotal)} hits &middot; {pct(groupTotal, totalHits)} of traffic
        </span>
      </div>
      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem', lineHeight: 1.55 }}>
        {description}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rows.map((row) => (
          <li key={row.class}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{row.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {formatNumber(row.hits)} &middot; {pct(row.hits, totalHits)}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-muted)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(totalHits > 0 ? (row.hits / totalHits) * 100 : 0, 1)}%`,
                  background: CALLER_COLORS[row.class] || iconColor,
                  borderRadius: 3,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type BarItem = { key: string; label: ReactNode; sublabel?: string; value: number };

function BarList({ items, colorVar }: { items: BarItem[]; colorVar: string }) {
  if (items.length === 0) {
    return <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No traffic recorded yet.</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {items.map((item) => (
        <li key={item.key}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {item.label}
              {item.sublabel && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.sublabel}</span>
              )}
            </span>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {formatCompact(item.value)}
            </strong>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-muted)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max((item.value / max) * 100, 3)}%`,
                background: colorVar,
                borderRadius: 4,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function OpennessCard({
  icon: Icon,
  color,
  title,
  detail,
}: {
  icon: typeof ShieldCheck;
  color: string;
  title: string;
  detail: string;
}) {
  return (
    <div
      style={{
        padding: '0.9rem 1rem',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        background: 'var(--bg-muted)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <Icon size={15} style={{ color }} />
        <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{title}</strong>
      </span>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{detail}</p>
    </div>
  );
}

export default async function TrustPage() {
  const stats = await getSiteStats();

  const aiRows = stats.callerBreakdown30d.filter((r) => AI_SYSTEM_CLASSES.includes(r.class));
  const crawlerRows = stats.callerBreakdown30d.filter(
    (r) => !AI_SYSTEM_CLASSES.includes(r.class) && r.class !== 'browser' && r.class !== 'unknown'
  );
  const browserRows = stats.callerBreakdown30d.filter((r) => r.class === 'browser');
  const unknownRows = stats.callerBreakdown30d.filter((r) => r.class === 'unknown');
  const totalHits30d = stats.callerBreakdown30d.reduce((acc, r) => acc + r.hits, 0);
  const totalAiHits30d = aiRows.reduce((acc, r) => acc + r.hits, 0);

  const endpointItems: BarItem[] = stats.endpointBreakdown30d.map((e: EndpointBreakdown) => ({
    key: e.endpoint,
    label: e.label,
    value: e.hits,
  }));

  const countryItems: BarItem[] = stats.topCountries30d.map((c: CountryBreakdown) => ({
    key: c.country,
    label: (
      <>
        <span aria-hidden="true">{flagEmoji(c.country)}</span> {countryName(c.country)}
      </>
    ),
    value: c.hits,
  }));

  const trafficGroups: TrafficGroup[] = [
    { key: 'ai', label: 'AI assistants', hits: totalAiHits30d, colorVar: '--tv-ai', ink: '#ffffff' },
    { key: 'crawler', label: 'Other crawlers & bots', hits: crawlerRows.reduce((a, r) => a + r.hits, 0), colorVar: '--tv-crawler', ink: '#ffffff' },
    { key: 'browser', label: 'Human browsers', hits: browserRows.reduce((a, r) => a + r.hits, 0), colorVar: '--tv-browser', ink: '#ffffff' },
    { key: 'unknown', label: 'Unclassified', hits: unknownRows.reduce((a, r) => a + r.hits, 0), colorVar: '--tv-unknown', ink: '#1a1200' },
  ].filter((g) => g.hits > 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: 'AllMCPs Trust & Traffic Transparency',
        description: metadata.description,
        url: 'https://allmcps.com/trust',
        author: { '@type': 'Organization', name: 'AllMCPs', url: 'https://allmcps.com' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Trust & Transparency', item: 'https://allmcps.com/trust' },
        ],
      },
    ],
  };

  const totalQualityServers = Object.values(stats.qualityTierBreakdown).reduce((a, b) => a + b, 0);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="page-shell page-shell--tool">
        <div className="page-shell-inner" style={{ maxWidth: 960 }}>
          <div className="surface page-panel">
            <h1 className="text-page-title" style={{ marginBottom: '0.75rem' }}>
              Trust &amp; Traffic Transparency
            </h1>
            <p className="text-lead" style={{ marginBottom: '2rem' }}>
              Every number on this page comes from our production database. No vanity
              metrics, no cherry-picked screenshots. Here&apos;s what&apos;s in the catalog,
              how people use it, and which AI systems and crawlers actually read it.
            </p>

            <SectionLabel title="The catalog" note="All-time totals across every listed MCP server." />
            <StatGrid>
              <StatTile icon={Cpu} color="#34d399" value={formatNumber(stats.totalServers)} label="MCP servers listed" />
              <StatTile icon={Tag} color="#60a5fa" value={formatNumber(stats.categoryCount)} label="Categories covered" />
              <StatTile icon={Wrench} color="#a855f7" value={formatNumber(stats.toolsIndexed)} label="Callable tools indexed" />
              <StatTile icon={ShieldCheck} color="#22d3ee" value={formatNumber(stats.verifiedCount)} label="Verified listings" />
            </StatGrid>

            <SectionLabel title="How people use it" note="All-time engagement, summed across every listing page." />
            <StatGrid>
              <StatTile icon={Eye} color="#38bdf8" value={formatNumber(stats.totalViews)} label="Listing views" />
              <StatTile icon={Copy} color="#f472b6" value={formatNumber(stats.totalCopies)} label="Install configs copied" />
              <StatTile icon={ThumbsUp} color="#fbbf24" value={formatNumber(stats.totalUpvotes)} label="Upvotes cast" />
            </StatGrid>

            {/* Feature #1: Tool Schema Verification & Sandbox Pilot */}
            <Panel>
              <SectionLabel
                tight
                icon={Terminal}
                title="Tool Introspection & Sandbox Verification"
                note="How we inspect, parse, and verify executable tool schemas across the directory."
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginTop: '1rem',
                }}
              >
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <Sparkles size={16} style={{ color: '#a855f7' }} />
                    <strong style={{ fontSize: '0.875rem' }}>Live MCP Handshakes</strong>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatNumber(stats.toolsSourceBreakdown.introspected)} servers
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Verified via live <code style={{ fontSize: '0.75rem' }}>tools/list</code> protocol handshakes against hosted endpoints.
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <Wrench size={16} style={{ color: '#60a5fa' }} />
                    <strong style={{ fontSize: '0.875rem' }}>README Structured Parsing</strong>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatNumber(stats.toolsSourceBreakdown.readme)} servers
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Extracted from repo documentation for stdio/CLI packages where no HTTP endpoint exists.
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <CheckCircle2 size={16} style={{ color: '#34d399' }} />
                    <strong style={{ fontSize: '0.875rem' }}>E2B Sandbox Pilot</strong>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {pct(stats.stdioPilotStats.okCount, stats.stdioPilotStats.totalTested)} pass rate
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {formatNumber(stats.stdioPilotStats.totalTested)} stdio packages isolated and tested in ephemeral execution sandboxes (avg latency: {(stats.stdioPilotStats.avgDurationMs / 1000).toFixed(1)}s).
                  </div>
                </div>
              </div>
            </Panel>

            {/* Feature #2: Catalog Quality & Ecosystem Signals */}
            <Panel>
              <SectionLabel
                tight
                icon={Award}
                title="Catalog Quality Spectrum & Ecosystem Signals"
                note="Deterministic quality tiering (0–100) and repository health signals across all active listings."
              />
              <div style={{ margin: '1rem 0 1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                  Listing Quality Tier Distribution ({formatNumber(totalQualityServers)} total active servers):
                </div>
                <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-muted)', gap: 2 }}>
                  {Object.entries(stats.qualityTierBreakdown).map(([tier, count]) => {
                    if (count === 0 || totalQualityServers === 0) return null;
                    const pctVal = (count / totalQualityServers) * 100;
                    return (
                      <div
                        key={tier}
                        title={`${tier}: ${formatNumber(count)} (${pct(count, totalQualityServers)})`}
                        style={{
                          width: `${pctVal}%`,
                          background: TIER_COLORS[tier] || '#94a3b8',
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem 1.2rem', marginTop: '0.65rem', padding: 0 }}>
                  {Object.entries(stats.qualityTierBreakdown).map(([tier, count]) => (
                    <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_COLORS[tier] || '#94a3b8' }} />
                      <strong>{tier}</strong>: {formatNumber(count)} ({pct(count, totalQualityServers)})
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <div style={{ padding: '0.85rem 1rem', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <ShieldCheck size={16} style={{ color: '#22d3ee' }} />
                    <strong style={{ fontSize: '0.85rem' }}>Reciprocal Badge Verified</strong>
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatNumber(stats.reciprocalBadgeCount)} listings
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Displaying an official AllMCPs badge or backlink on their GitHub README or website.
                  </div>
                </div>

                <div style={{ padding: '0.85rem 1rem', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <GitCommit size={16} style={{ color: '#34d399' }} />
                    <strong style={{ fontSize: '0.85rem' }}>Active Codebases (Last 30 Days)</strong>
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatNumber(stats.recentCommitCount30d)} listings
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Repositories with active commits or pushes measured by automated health checks.
                  </div>
                </div>
              </div>
            </Panel>

            {stats.dailyTrend30d.length > 0 && (
              <Panel>
                <SectionLabel
                  tight
                  icon={Activity}
                  title="Traffic over the last 30 days"
                  note="Total requests to our API vs. the subset that came from a named AI assistant. Hover or focus the chart for exact daily numbers."
                />
                <TrendChart data={stats.dailyTrend30d} />
              </Panel>
            )}

            {/* Feature #4: Share of AI Traffic Breakdown */}
            {totalAiHits30d > 0 && (
              <Panel>
                <SectionLabel
                  tight
                  icon={PieChart}
                  title="Share of AI Traffic"
                  note={`Market share among AI assistants and LLM crawlers hit over the last 30 days (${formatNumber(totalAiHits30d)} total requests).`}
                />
                <BarList
                  items={aiRows.map((r) => ({
                    key: r.class,
                    label: r.label,
                    sublabel: `${pct(r.hits, totalAiHits30d)} of AI traffic`,
                    value: r.hits,
                  }))}
                  colorVar="var(--tv-ai)"
                />
              </Panel>
            )}

            <Panel>
              <SectionLabel
                tight
                title="Who's reading the API"
                note={`${formatNumber(totalHits30d)} requests from ${formatNumber(stats.countryCount)} countries in the last 30 days.`}
              />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                Every request to our search, listing, and <Link href="/llms.txt">llms.txt</Link> endpoints
                gets classified server-side from its User-Agent. &ldquo;AI assistants&rdquo; only counts
                named systems. Generic crawlers and unclassified agents are counted separately, so the two
                numbers never get blended into one.
              </p>

              <TrafficStackedBar groups={trafficGroups} total={totalHits30d} />

              <Group
                title="AI assistants & their crawlers"
                description="Chat and agent traffic from Claude, ChatGPT, Gemini, Perplexity, Cursor, Copilot, and Windsurf, plus the crawlers those companies run to index content, like ClaudeBot and GPTBot."
                rows={aiRows}
                totalHits={totalHits30d}
                icon={GROUP_ICON.ai}
                iconColor="var(--brand-cyan)"
              />
              <Group
                title="Other crawlers & bots"
                description="General-purpose web crawlers, link-preview bots, and unnamed automated clients. Not AI systems, but still worth counting."
                rows={crawlerRows}
                totalHits={totalHits30d}
                icon={GROUP_ICON.crawler}
                iconColor="#94a3b8"
              />
              <Group
                title="Human visitors (browser requests to the API)"
                description="Browsers hitting API endpoints directly, separate from normal page views."
                rows={browserRows}
                totalHits={totalHits30d}
                icon={GROUP_ICON.browser}
                iconColor="#60a5fa"
              />
              <Group
                title="Unclassified"
                description="Requests with no recognizable User-Agent pattern."
                rows={unknownRows}
                totalHits={totalHits30d}
                icon={GROUP_ICON.unknown}
                iconColor="#4b5563"
              />
            </Panel>

            {(endpointItems.length > 0 || countryItems.length > 0) && (
              <div
                className="trust-viz"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                {endpointItems.length > 0 && (
                  <Panel>
                    <SectionLabel tight icon={Radio} title="What's being requested" note="API surfaces hit in the last 30 days, most-used first." />
                    <BarList items={endpointItems} colorVar="var(--tv-ai)" />
                  </Panel>
                )}
                {countryItems.length > 0 && (
                  <Panel>
                    <SectionLabel tight icon={Globe} title="Where requests come from" note="Top request-origin countries in the last 30 days." />
                    <BarList items={countryItems} colorVar="var(--tv-browser)" />
                  </Panel>
                )}
              </div>
            )}

            <SectionLabel title="Why we're open about this" note="No login gate, no filtering. This is the same dashboard our team looks at." />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <OpennessCard
                icon={Bot}
                color="var(--brand-cyan)"
                title="Crawlers are allowlisted"
                detail="Our robots.txt allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Amazonbot, and Bytespider to read the catalog, search API, and llms-full.txt."
              />
              <OpennessCard
                icon={MessageSquare}
                color="#34d399"
                title="Built to be cited"
                detail="We set ai-input=yes so answer engines and assistants can quote us directly."
              />
              <OpennessCard
                icon={Lock}
                color="#f472b6"
                title="Not used for training"
                detail="We set ai-train=no. The catalog is available to read, not to train on."
              />
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              See it yourself: <a href="/robots.txt" target="_blank" rel="noopener">robots.txt</a> and{' '}
              <a href="/llms-full.txt" target="_blank" rel="noopener">llms-full.txt</a>.
            </p>
          </div>
        </div>
      </main>
      <style>{`
        .trust-viz {
          --tv-ai: #3987e5;
          --tv-crawler: #d95926;
          --tv-browser: #199e70;
          --tv-unknown: #c98500;
        }
        [data-theme="light"] .trust-viz {
          --tv-ai: #2a78d6;
          --tv-crawler: #eb6834;
          --tv-browser: #1baf7a;
          --tv-unknown: #eda100;
        }
      `}</style>
    </>
  );
}
