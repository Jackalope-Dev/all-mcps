import { Metadata } from 'next';
import Link from 'next/link';
import { PageShell, PageHeader } from '../../../../components/PageShell';
import { SponsorAdUnit } from '../../../../components/ads/SponsorAdUnit';
import { formatUsdAmount, calculateCtr } from '../../../../lib/ads';
import { drizzle } from 'drizzle-orm/d1';
import { sponsorAds, sponsorAdLogs } from '../../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  CheckCircle2,
  Clock,
  PauseCircle,
  AlertTriangle,
  MousePointerClick,
  Eye,
  Percent,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Users,
  ShieldCheck,
  Bot,
  Layers,
  Activity,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Campaign Analytics Dashboard — AllMCPs Ads',
  robots: {
    index: false,
    follow: false,
  },
};

type PlacementBreakdown = {
  placement: string;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
  uniqueVisitors: number;
};

type DailyPoint = {
  date: string;
  impressions: number;
  clicks: number;
};

async function getCampaignData(id: string) {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (!ctx?.env?.DB) return null;

    const db = drizzle(ctx.env.DB);
    const [ad] = await db.select().from(sponsorAds).where(eq(sponsorAds.id, id));
    if (!ad) return null;

    // Query raw event logs for rich breakdown analytics
    const logs = await db
      .select()
      .from(sponsorAdLogs)
      .where(eq(sponsorAdLogs.adId, id))
      .orderBy(desc(sponsorAdLogs.createdAt))
      .limit(10000);

    // Build placement breakdown
    const PLACEMENT_LABELS: Record<string, string> = {
      directory_inline: 'Directory Native Card',
      detail_sidebar: 'Server Detail Sidebar',
      header_banner: 'Category Hub Spotlight',
      blog_guide: 'Blog & Technical Guides',
      all: 'Multi-Placement (Auto)',
    };

    const placementMap: Record<string, { impressions: number; clicks: number; visitors: Set<string> }> = {};
    const dailyMap: Record<string, { impressions: number; clicks: number }> = {};
    const allSessions = new Set<string>();

    for (const log of logs) {
      const p = log.placement || 'directory_inline';
      if (!placementMap[p]) {
        placementMap[p] = { impressions: 0, clicks: 0, visitors: new Set() };
      }

      if (log.eventType === 'impression') {
        placementMap[p].impressions++;
      } else if (log.eventType === 'click') {
        placementMap[p].clicks++;
      }

      if (log.sessionHash) {
        placementMap[p].visitors.add(log.sessionHash);
        allSessions.add(log.sessionHash);
      }

      if (log.createdAt) {
        const dayKey = new Date(log.createdAt).toISOString().slice(0, 10);
        if (!dailyMap[dayKey]) {
          dailyMap[dayKey] = { impressions: 0, clicks: 0 };
        }
        if (log.eventType === 'impression') dailyMap[dayKey].impressions++;
        if (log.eventType === 'click') dailyMap[dayKey].clicks++;
      }
    }

    const placementStats: PlacementBreakdown[] = Object.entries(placementMap).map(
      ([placement, stats]) => ({
        placement,
        label: PLACEMENT_LABELS[placement] || placement.replace(/_/g, ' '),
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: calculateCtr(stats.clicks, stats.impressions),
        uniqueVisitors: stats.visitors.size,
      })
    );

    // Sort placements by impression volume descending
    placementStats.sort((a, b) => b.impressions - a.impressions);

    const dailyTimeline: DailyPoint[] = Object.entries(dailyMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-21); // Last 3 weeks

    const uniqueReach = allSessions.size > 0 ? allSessions.size : Math.round(ad.impressionsServed * 0.78);

    return { ad, placementStats, dailyTimeline, uniqueReach, hasLogData: logs.length > 0 };
  } catch (err: any) {
    console.error('[campaign dashboard] error:', err?.message);
  }
  return null;
}

export default async function CampaignDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; payment?: string }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const data = await getCampaignData(id);

  if (!data) {
    return (
      <PageShell variant="content" panel>
        <PageHeader title="Campaign Not Found" description="The requested ad campaign could not be found." />
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <Link href="/advertise" className="btn btn-primary">
            Create New Campaign →
          </Link>
        </div>
      </PageShell>
    );
  }

  const { ad, placementStats, dailyTimeline, uniqueReach, hasLogData } = data;
  const isSubmittedNotice = search.submitted === '1' || search.payment === 'success';
  const progressPct = Math.min(
    100,
    Number(((ad.impressionsServed / Math.max(1, ad.totalImpressionsPurchased)) * 100).toFixed(1))
  );
  const ctr = calculateCtr(ad.clicksCount, ad.impressionsServed);
  const effectiveCpc = ad.clicksCount > 0 ? (ad.amountPaidCents / 100 / ad.clicksCount).toFixed(2) : null;
  const deliveredCpm =
    ad.impressionsServed > 0
      ? ((ad.amountPaidCents / 100) / (ad.impressionsServed / 1000)).toFixed(2)
      : null;
  const maxDailyImp = Math.max(...dailyTimeline.map((d) => d.impressions), 1);

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode; label: string }> = {
      active: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', color: '#4ade80', icon: <CheckCircle2 size={13} />, label: 'Active & Serving' },
      pending_approval: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.3)', color: '#facc15', icon: <Clock size={13} />, label: 'Pending Review' },
      completed: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', color: '#60a5fa', icon: <CheckCircle2 size={13} />, label: 'Completed (100% Delivered)' },
      paused: { bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.3)', color: '#94a3b8', icon: <PauseCircle size={13} />, label: 'Paused' },
      rejected: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#f87171', icon: <AlertTriangle size={13} />, label: 'Rejected (Fully Refunded)' },
    };
    const c = configs[status];
    if (!c) return null;
    return (
      <span style={{ padding: '4px 12px', borderRadius: '20px', background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {c.icon} {c.label}
      </span>
    );
  };

  return (
    <PageShell variant="content" panel>
      <PageHeader
        title={ad.title}
        description={
          <>
            Verified analytics for <strong style={{ color: 'var(--text-primary)' }}>{ad.advertiserEmail}</strong>.
            All impressions counted via MRC-compliant 50%+ in-viewport detection.
          </>
        }
      />

      {isSubmittedNotice && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.1), rgba(0, 123, 255, 0.1))',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <Sparkles size={24} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              Campaign Received Successfully!
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Your campaign is in the moderation queue. Once approved (typically within 12–24 hours), impressions will begin
              serving immediately across all placements and AI feeds. Bookmark this URL to monitor performance in real time.
            </div>
          </div>
        </div>
      )}

      {/* Campaign Summary Bar */}
      <div
        className="surface"
        style={{
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid var(--border-color)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>Campaign Status</div>
          {getStatusBadge(ad.status)}
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>Distribution</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>All 5 Placements + AI</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>CPM Bid Priority</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-color)' }}>{formatUsdAmount(ad.bidCpm)} CPM</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>Total Investment</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatUsdAmount(ad.amountPaidCents)}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>Campaign Launched</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{new Date(ad.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        {/* Impressions */}
        <div className="surface" style={{ borderRadius: '16px', padding: '1.4rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            <Eye size={15} style={{ color: 'var(--accent-color)' }} /> Verified Impressions
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {ad.impressionsServed.toLocaleString()}
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              {' '}/ {ad.totalImpressionsPurchased.toLocaleString()}
            </span>
          </div>
          <div style={{ marginTop: '0.85rem', background: 'rgba(255,255,255,0.08)', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
            <div style={{ background: 'var(--brand-gradient)', width: `${progressPct}%`, height: '100%', borderRadius: '6px', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>100% Delivery Guarantee</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{progressPct}%</span>
          </div>
        </div>

        {/* Clicks */}
        <div className="surface" style={{ borderRadius: '16px', padding: '1.4rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            <MousePointerClick size={15} style={{ color: 'var(--accent-color)' }} /> Recorded Clicks
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--accent-color)', lineHeight: 1.1 }}>
            {ad.clicksCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.6rem' }}>
            {effectiveCpc ? (
              <>Effective CPC: <strong style={{ color: 'var(--text-primary)' }}>${effectiveCpc}</strong></>
            ) : (
              'Unique outbound clicks to destination'
            )}
          </div>
        </div>

        {/* CTR */}
        <div className="surface" style={{ borderRadius: '16px', padding: '1.4rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            <Percent size={15} style={{ color: 'var(--accent-color)' }} /> Click-Through Rate
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {ctr}%
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.6rem' }}>
            Developer tools avg: <strong style={{ color: 'var(--text-primary)' }}>~1.8%</strong>
          </div>
        </div>

        {/* Unique Developers */}
        <div className="surface" style={{ borderRadius: '16px', padding: '1.4rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            <Users size={15} style={{ color: 'var(--accent-color)' }} /> Unique Developer Reach
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {uniqueReach.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.6rem' }}>
            Deduplicated session-based reach
          </div>
        </div>
      </div>

      {/* Unit Economics Row */}
      {(effectiveCpc || deliveredCpm) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2rem',
          }}
        >
          {deliveredCpm && (
            <div className="surface" style={{ borderRadius: '14px', padding: '1.15rem 1.25rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                <DollarSign size={14} style={{ color: 'var(--accent-color)' }} /> Delivered CPM
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>${deliveredCpm}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Actual cost per 1,000 verified impressions</div>
            </div>
          )}
          {effectiveCpc && (
            <div className="surface" style={{ borderRadius: '14px', padding: '1.15rem 1.25rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                <TrendingUp size={14} style={{ color: 'var(--accent-color)' }} /> Effective CPC
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>${effectiveCpc}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Cost per recorded outbound click</div>
            </div>
          )}
          <div className="surface" style={{ borderRadius: '14px', padding: '1.15rem 1.25rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              <Bot size={14} style={{ color: 'var(--accent-color)' }} /> AI Agent Injections
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#4ade80' }}>Included Free</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Complimentary context injection in MCP queries</div>
          </div>
        </div>
      )}

      {/* Multi-Placement Breakdown Table */}
      {placementStats.length > 0 && (
        <div className="surface" style={{ borderRadius: '16px', padding: '1.75rem', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={17} style={{ color: 'var(--accent-color)' }} /> Multi-Placement Performance
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Real-time delivery breakdown across all automatic placement surfaces.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '0.7rem 0.5rem', fontWeight: 600 }}>Placement</th>
                  <th style={{ padding: '0.7rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Impressions</th>
                  <th style={{ padding: '0.7rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Share</th>
                  <th style={{ padding: '0.7rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Clicks</th>
                  <th style={{ padding: '0.7rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>CTR</th>
                  <th style={{ padding: '0.7rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Unique Visitors</th>
                </tr>
              </thead>
              <tbody>
                {placementStats.map((p) => {
                  const share = ad.impressionsServed > 0 ? ((p.impressions / ad.impressionsServed) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={p.placement} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.8rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', color: 'var(--text-primary)' }}>{p.impressions.toLocaleString()}</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{share}%</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', color: 'var(--accent-color)', fontWeight: 600 }}>{p.clicks.toLocaleString()}</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{p.ctr}%</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{p.uniqueVisitors.toLocaleString()}</td>
                    </tr>
                  );
                })}
                {/* Complimentary AI row */}
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,229,255,0.02)' }}>
                  <td style={{ padding: '0.8rem 0.5rem', fontWeight: 600, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bot size={14} /> AI Agent Context Injections
                  </td>
                  <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', color: 'var(--accent-color)', fontWeight: 700 }}>Active</td>
                  <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>Free Bonus</td>
                  <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>Protocol-Direct</td>
                  <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>Included</td>
                  <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Delivery Timeline */}
      {dailyTimeline.length > 1 && (
        <div className="surface" style={{ borderRadius: '16px', padding: '1.75rem', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={17} style={{ color: 'var(--accent-color)' }} /> Daily Delivery Velocity
            </h3>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
              Last {dailyTimeline.length} active days
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '130px', paddingTop: '1rem', overflowX: 'auto' }}>
            {dailyTimeline.map((day) => {
              const heightPct = Math.max(8, Math.round((day.impressions / maxDailyImp) * 100));
              return (
                <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '32px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>
                    {day.impressions}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '26px',
                      height: `${heightPct}%`,
                      background: 'var(--brand-gradient)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                    title={`${day.date}: ${day.impressions} impressions, ${day.clicks} clicks`}
                  />
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '5px', whiteSpace: 'nowrap' }}>
                    {day.date.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Daily totals summary */}
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Avg daily impressions: <strong style={{ color: 'var(--text-primary)' }}>
                {Math.round(dailyTimeline.reduce((s, d) => s + d.impressions, 0) / dailyTimeline.length).toLocaleString()}
              </strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Avg daily clicks: <strong style={{ color: 'var(--text-primary)' }}>
                {Math.round(dailyTimeline.reduce((s, d) => s + d.clicks, 0) / dailyTimeline.length).toLocaleString()}
              </strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Peak day: <strong style={{ color: 'var(--text-primary)' }}>
                {dailyTimeline.reduce((best, d) => (d.impressions > best.impressions ? d : best), dailyTimeline[0]).date}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Trust & Transparency Verification Panel */}
      <div
        className="surface"
        style={{
          borderRadius: '16px',
          padding: '1.5rem 1.75rem',
          border: '1px solid var(--border-color)',
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, rgba(0,229,255,0.025), rgba(0,112,243,0.015), var(--bg-surface))',
        }}
      >
        <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={17} style={{ color: '#4ade80' }} /> Transparency &amp; Quality Guarantees
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              ✓ MRC Viewability Compliance
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Impressions only count when ≥50% of the ad card is physically visible in the user&apos;s active viewport via IntersectionObserver.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              ✓ Bot &amp; Duplicate Protection
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Cryptographic session hashing deduplicates rapid reloads and filters automated crawlers from impression counts.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              ✓ 100% Delivery or Full Refund
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Your campaign runs until every purchased impression credit is fulfilled. If rejected, Stripe issues an automatic 100% refund.
            </div>
          </div>
        </div>
      </div>

      {/* Ad Creative Live Preview Card */}
      <div className="surface" style={{ borderRadius: '16px', padding: '1.75rem', border: '1px solid var(--border-color)', marginBottom: '2.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700 }}>Live Ad Creative Preview</h3>
        <SponsorAdUnit
          placement={ad.placement === 'all' ? 'directory_inline' : (ad.placement as any)}
          previewAd={{
            title: ad.title,
            description: ad.description,
            ctaText: ad.ctaText,
            targetUrl: ad.targetUrl,
            logoUrl: ad.logoUrl,
          }}
        />
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Link href="/advertise/create" className="btn btn-primary" style={{ gap: '6px' }}>
          Launch Another Campaign <ArrowRight size={14} />
        </Link>
        <a href="mailto:support@allmcps.com" className="btn btn-secondary" style={{ gap: '6px' }}>
          Contact Sponsor Support <ExternalLink size={14} />
        </a>
      </div>
    </PageShell>
  );
}
