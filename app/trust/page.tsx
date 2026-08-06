import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteStats, AI_SYSTEM_CLASSES } from '../../lib/siteStats';
import type { CallerBreakdown } from '../../lib/siteStats';

export const metadata: Metadata = {
  title: 'Trust & Traffic Transparency | AllMCPs',
  description:
    'Live, unfiltered numbers on how people and AI systems actually use AllMCPs — site visits, install activity, and a full breakdown of every AI assistant and crawler that reads the directory.',
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

function Group({
  title,
  description,
  rows,
  totalHits,
  accent,
}: {
  title: string;
  description: string;
  rows: CallerBreakdown[];
  totalHits: number;
  accent: string;
}) {
  if (rows.length === 0) return null;
  const groupTotal = rows.reduce((acc, r) => acc + r.hits, 0);

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>{title}</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
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
                  background: accent,
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

export default async function TrustPage() {
  const stats = await getSiteStats();

  const aiRows = stats.callerBreakdown30d.filter((r) => AI_SYSTEM_CLASSES.includes(r.class));
  const crawlerRows = stats.callerBreakdown30d.filter(
    (r) => !AI_SYSTEM_CLASSES.includes(r.class) && r.class !== 'browser' && r.class !== 'unknown'
  );
  const browserRows = stats.callerBreakdown30d.filter((r) => r.class === 'browser');
  const unknownRows = stats.callerBreakdown30d.filter((r) => r.class === 'unknown');
  const totalHits30d = stats.callerBreakdown30d.reduce((acc, r) => acc + r.hits, 0);

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
            <p className="directory-category-kicker" style={{ marginBottom: '0.5rem' }}>
              Real numbers, no spin
            </p>
            <h1 className="text-page-title" style={{ marginBottom: '0.75rem' }}>
              Trust &amp; Traffic Transparency
            </h1>
            <p className="text-lead" style={{ marginBottom: '1.5rem' }}>
              Every number below comes straight from our production database — no vanity metrics
              borrowed from other people&apos;s repos or npm packages. This page shows exactly how
              people use the directory and which AI systems and crawlers actually read it, updated
              live on a trailing 30-day window.
            </p>

            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>How people use AllMCPs</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                marginBottom: '2rem',
              }}
            >
              {[
                { label: 'MCP servers listed', value: formatNumber(stats.totalServers) },
                { label: 'Listing views', value: formatNumber(stats.totalViews) },
                { label: 'Install configs copied', value: formatNumber(stats.totalCopies) },
                { label: 'Upvotes cast', value: formatNumber(stats.totalUpvotes) },
                { label: 'Countries reached (30d)', value: formatNumber(stats.countryCount) },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: '0.9rem 1rem',
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-muted)',
                  }}
                >
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: '1.25rem', margin: '2rem 0 0.5rem' }}>Who&apos;s reading the API (last 30 days)</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Every request to our search, listing, and <Link href="/llms.txt">llms.txt</Link> endpoints
              is classified server-side from its User-Agent. We deliberately keep &ldquo;AI Reads&rdquo;
              limited to named AI assistants and their crawlers — generic web crawlers and unclassified
              agents are broken out separately below so the two never get blended into one inflated
              number.
            </p>

            <Group
              title="AI assistants & their crawlers"
              description="Live chat/agent traffic (Claude, ChatGPT, Gemini, Perplexity, Cursor, Copilot, Windsurf) plus the offline crawlers those companies run to index content (ClaudeBot, GPTBot)."
              rows={aiRows}
              totalHits={totalHits30d}
              accent="var(--brand-cyan)"
            />
            <Group
              title="Other crawlers & bots"
              description="General-purpose web crawlers, link-preview bots, and unnamed automated clients — not AI systems, but still worth counting honestly."
              rows={crawlerRows}
              totalHits={totalHits30d}
              accent="#94a3b8"
            />
            <Group
              title="Human visitors (browser requests to the API)"
              description="Real browsers hitting API endpoints directly, separate from normal page views."
              rows={browserRows}
              totalHits={totalHits30d}
              accent="#60a5fa"
            />
            <Group
              title="Unclassified"
              description="Requests with no recognizable User-Agent pattern."
              rows={unknownRows}
              totalHits={totalHits30d}
              accent="#4b5563"
            />

            <h2 style={{ fontSize: '1.25rem', margin: '2rem 0 0.75rem' }}>Why we&apos;re open about this</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '0.75rem' }}>
              Our <a href="/robots.txt" target="_blank" rel="noopener">robots.txt</a> explicitly allowlists
              AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Amazonbot, Bytespider) to
              read our catalog, search API, and{' '}
              <a href="/llms-full.txt" target="_blank" rel="noopener">llms-full.txt</a>. We set{' '}
              <code>ai-input=yes</code> so answer engines can cite us, and{' '}
              <code>ai-train=no</code> so the catalog isn&apos;t used as training data. Nothing on this
              page is gated behind a login or gamed by us — it&apos;s the same data our own team looks at.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
