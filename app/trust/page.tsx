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
} from 'lucide-react';
import { getSiteStats, AI_SYSTEM_CLASSES } from '../../lib/siteStats';
import { CALLER_COLORS } from '../../lib/accessLog';
import type { CallerBreakdown } from '../../lib/siteStats';

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

const GROUP_ICON: Record<string, typeof Bot> = {
  ai: Bot,
  crawler: Search,
  browser: Users,
  unknown: HelpCircle,
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

function SectionLabel({ title, note }: { title: string; note: string }) {
  return (
    <div style={{ margin: '2.25rem 0 0.75rem' }}>
      <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.2rem' }}>{title}</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{note}</p>
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

/** Part-to-whole stacked bar for the top-level traffic split, plus a legend with exact counts (the direct-label relief the light-mode palette requires). */
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

  const trafficGroups: TrafficGroup[] = [
    { key: 'ai', label: 'AI assistants', hits: aiRows.reduce((a, r) => a + r.hits, 0), colorVar: '--tv-ai', ink: '#ffffff' },
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="page-shell page-shell--tool">
        <div className="page-shell-inner" style={{ maxWidth: 880 }}>
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
              <StatTile icon={ShieldCheck} color="#22d3ee" value={formatNumber(stats.verifiedCount)} label="Verified listings" />
            </StatGrid>

            <SectionLabel title="How people use it" note="All-time engagement, summed across every listing page." />
            <StatGrid>
              <StatTile icon={Eye} color="#38bdf8" value={formatNumber(stats.totalViews)} label="Listing views" />
              <StatTile icon={Copy} color="#f472b6" value={formatNumber(stats.totalCopies)} label="Install configs copied" />
              <StatTile icon={ThumbsUp} color="#fbbf24" value={formatNumber(stats.totalUpvotes)} label="Upvotes cast" />
            </StatGrid>

            <SectionLabel
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
