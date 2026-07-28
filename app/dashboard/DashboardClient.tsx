'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import { toast } from '@/components/ui/Toast';
import { parsePendingRevision } from '@/lib/pendingRevision';
import { CALLER_LABELS, CALLER_COLORS, type CallerClass } from '@/lib/accessLog';
import { SURFACE_LABELS, type ImpressionSurface } from '@/lib/impressionLog';
import type { AnalyticsSummary, ServerAnalytics } from '@/lib/analytics';
import {
  Eye, Heart, Download, TrendingUp, TrendingDown, Minus,
  BarChart3, Search, Globe, Lock, ChevronDown, ChevronUp,
  Activity, Zap,
} from 'lucide-react';

type Server = {
  id: string;
  name: string;
  description: string;
  category: string;
  websiteUrl?: string | null;
  pendingRevision?: string | null;
  isPremium?: boolean;
  views?: number;
  copies?: number;
  upvotes?: number;
};

type Props = {
  initialServers: Server[];
  initialAnalytics: Record<string, AnalyticsSummary>;
  isPremium: boolean;
};

export default function DashboardClient({ initialServers, initialAnalytics, isPremium }: Props) {
  const [servers, setServers] = useState(initialServers);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailAnalytics, setDetailAnalytics] = useState<Record<string, ServerAnalytics>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', websiteUrl: '' });
  const [saving, setSaving] = useState(false);

  const startEdit = (server: Server) => {
    setEditingId(server.id);
    setForm({
      name: server.name,
      description: server.description,
      category: server.category,
      websiteUrl: server.websiteUrl || '',
    });
  };

  const submitEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit edit');
      }
      const submittedAt = new Date().toISOString();
      setServers((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, pendingRevision: JSON.stringify({ proposed: form, submittedAt }) }
            : s
        )
      );
      toast.success('Edit submitted', { description: data.message || 'Awaiting review.' });
      setEditingId(null);
    } catch (err: any) {
      toast.error('Could not submit edit', { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = async (serverId: string) => {
    if (expandedId === serverId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(serverId);

    if (!isPremium) return;
    if (detailAnalytics[serverId]) return;

    setLoadingDetail(serverId);
    try {
      const res = await fetch(`/api/dashboard/analytics?serverId=${serverId}`);
      if (res.ok) {
        const data = (await res.json()) as { analytics: ServerAnalytics };
        setDetailAnalytics((prev) => ({ ...prev, [serverId]: data.analytics }));
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingDetail(null);
    }
  };

  if (servers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          You don&apos;t have any claimed listings yet.
        </p>
        <Link href="/browse" className="btn btn-primary">
          Browse & Claim Your MCP
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Global stats banner */}
      {isPremium && (
        <div style={premiumBannerStyle}>
          <Zap size={16} style={{ color: '#00E5FF' }} />
          <span style={{ fontWeight: 600, color: '#00E5FF' }}>Premium Analytics Active</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            — Your listings are tracked across all directory surfaces
          </span>
        </div>
      )}

      {servers.map((server) => {
        const pending = parsePendingRevision(server.pendingRevision);
        const isEditing = editingId === server.id;
        const isExpanded = expandedId === server.id;
        const summary = analytics[server.id];
        const detail = detailAnalytics[server.id];
        const isLoadingDetail = loadingDetail === server.id;

        return (
          <div key={server.id} style={cardStyle}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ marginBottom: '0.25rem', fontSize: '1.2rem' }}>{server.name}</h3>
                {pending && (
                  <p style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
                    Awaiting review since {new Date(pending.submittedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {server.isPremium && (
                  <span style={premiumBadgeStyle}>★ Premium</span>
                )}
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => toggleExpand(server.id)}
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isExpanded ? 'Collapse' : 'Analytics'}
                </button>
              </div>
            </div>

            {/* Quick stats row — always visible */}
            <div style={quickStatsRowStyle}>
              <StatPill icon={<Eye size={13} />} label="Views" value={server.views || 0} />
              <StatPill icon={<Download size={13} />} label="Installs" value={server.copies || 0} />
              <StatPill icon={<Heart size={13} />} label="Upvotes" value={server.upvotes || 0} />
              {summary && (
                <>
                  <StatPill
                    icon={<Activity size={13} />}
                    label="API Hits"
                    value={summary.totalApiHits}
                    accent
                  />
                  <StatPill
                    icon={<Globe size={13} />}
                    label="Impressions"
                    value={summary.totalImpressions}
                    accent
                  />
                  <TrendIndicator trend={summary.trend} />
                </>
              )}
            </div>

            {/* Expanded analytics panel */}
            {isExpanded && (
              <div style={{ marginTop: '1rem' }}>
                {!isPremium ? (
                  <PremiumTeaser />
                ) : isLoadingDetail ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    <Activity size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '0.5rem' }}>Loading analytics…</p>
                  </div>
                ) : detail ? (
                  <AnalyticsPanel detail={detail} />
                ) : (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                    No analytics data yet. Data will appear as LLMs and users interact with your listing.
                  </p>
                )}
              </div>
            )}

            {/* Edit section */}
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                />
                <textarea
                  className="form-input"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  rows={4}
                />
                <input
                  className="form-input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Category"
                />
                <input
                  className="form-input"
                  type="url"
                  value={form.websiteUrl}
                  onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://yoursite.com"
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" disabled={saving} onClick={submitEdit}>
                    {saving ? 'Submitting…' : pending ? 'Update pending edit' : 'Submit for review'}
                  </button>
                  <button className="btn btn-secondary" disabled={saving} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => startEdit(server)}>
                  {pending ? 'Edit pending draft' : 'Edit'}
                </button>
                <Link href={`/mcp/${server.id}`} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                  View listing →
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Sub-components ─── */

function StatPill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.35rem',
      fontSize: '0.8rem', color: accent ? '#00E5FF' : 'var(--text-secondary)',
      background: accent ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.03)',
      padding: '0.3rem 0.6rem', borderRadius: '8px',
      border: `1px solid ${accent ? 'rgba(0,229,255,0.2)' : 'var(--border-color)'}`,
    }}>
      {icon}
      <span style={{ fontWeight: 600, color: accent ? '#00E5FF' : 'var(--text-primary)' }}>
        {value.toLocaleString()}
      </span>
      <span>{label}</span>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  const config = {
    up: { Icon: TrendingUp, color: '#34D399', label: 'Trending up' },
    down: { Icon: TrendingDown, color: '#F87171', label: 'Trending down' },
    flat: { Icon: Minus, color: '#94A3B8', label: 'Stable' },
  };
  const { Icon, color, label } = config[trend];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      fontSize: '0.75rem', color, fontWeight: 600,
    }} title={label}>
      <Icon size={14} />
      {label}
    </div>
  );
}

function PremiumTeaser() {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: '12px',
      border: '1px solid rgba(0,229,255,0.3)',
      background: 'linear-gradient(135deg, rgba(0,229,255,0.06), rgba(0,123,255,0.04))',
      padding: '2rem', textAlign: 'center',
    }}>
      {/* Blurred fake chart background */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.15, filter: 'blur(6px)',
        background: 'repeating-linear-gradient(90deg, #00E5FF 0px, #00E5FF 2px, transparent 2px, transparent 20px)',
      }} />

      <Lock size={32} style={{ color: '#00E5FF', marginBottom: '0.75rem' }} />
      <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Premium Analytics</h4>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
        See which LLMs &amp; AI agents use your MCP server, track impressions across every directory surface, and discover what search queries find you.
      </p>
      <Link href="/pricing" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <Zap size={16} /> Upgrade to Premium
      </Link>
    </div>
  );
}

function AnalyticsPanel({ detail }: { detail: ServerAnalytics }) {
  return (
    <div style={{
      display: 'grid', gap: '1.25rem',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    }}>
      {/* LLM Caller Breakdown */}
      <div style={panelCardStyle}>
        <h4 style={panelTitleStyle}>
          <BarChart3 size={16} style={{ color: '#00E5FF' }} />
          Which LLMs Use Your MCP
        </h4>
        {detail.byCallerClass.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No API access data yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {detail.byCallerClass.map((row) => (
              <CallerBar
                key={row.caller}
                caller={row.caller as CallerClass}
                hits={row.hits}
                pct={row.pct}
              />
            ))}
          </div>
        )}
      </div>

      {/* Impression Surface Breakdown */}
      <div style={panelCardStyle}>
        <h4 style={panelTitleStyle}>
          <Eye size={16} style={{ color: '#00E5FF' }} />
          Where Users See You
        </h4>
        {detail.bySurface.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No impression data yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {detail.bySurface.map((row) => (
              <SurfaceBar
                key={row.surface}
                surface={row.surface as ImpressionSurface}
                impressions={row.impressions}
                total={detail.bySurface.reduce((s, r) => s + r.impressions, 0)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Daily Activity Sparkline */}
      <div style={panelCardStyle}>
        <h4 style={panelTitleStyle}>
          <Activity size={16} style={{ color: '#00E5FF' }} />
          Daily API Activity (30 days)
        </h4>
        {detail.byDay.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No daily data yet.</p>
        ) : (
          <Sparkline data={detail.byDay.map((d) => d.hits)} labels={detail.byDay.map((d) => d.date)} />
        )}
      </div>

      {/* Search Discovery */}
      <div style={panelCardStyle}>
        <h4 style={panelTitleStyle}>
          <Search size={16} style={{ color: '#00E5FF' }} />
          Search Queries That Find You
        </h4>
        {detail.recentSearchQueries.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No search data yet.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {detail.recentSearchQueries.slice(0, 15).map((q) => (
              <span key={q} style={queryChipStyle}>
                &ldquo;{q}&rdquo;
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CallerBar({ caller, hits, pct }: { caller: CallerClass; hits: number; pct: number }) {
  const label = CALLER_LABELS[caller] || caller;
  const color = CALLER_COLORS[caller] || '#6B7280';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{hits.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          width: `${Math.max(pct, 2)}%`,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function SurfaceBar({ surface, impressions, total }: { surface: ImpressionSurface; impressions: number; total: number }) {
  const label = SURFACE_LABELS[surface] || surface;
  const pct = total > 0 ? Math.round((impressions / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{impressions.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          width: `${Math.max(pct, 2)}%`,
          background: 'linear-gradient(90deg, #00E5FF, #007BFF)',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function Sparkline({ data, labels }: { data: number[]; labels: string[] }) {
  if (data.length === 0) return null;

  const width = 320;
  const height = 80;
  const padding = 4;
  const max = Math.max(...data, 1);
  const step = (width - padding * 2) / Math.max(data.length - 1, 1);

  const points = data.map((v, i) => ({
    x: padding + i * step,
    y: height - padding - ((v / max) * (height - padding * 2)),
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Area fill
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', maxHeight: '100px' }}
      >
        <defs>
          <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={pathD} fill="none" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Hover dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#00E5FF" opacity="0" style={{ transition: 'opacity 0.2s' }}>
            <title>{labels[i]}: {data[i]} hits</title>
            <set attributeName="opacity" to="1" begin="mouseover" end="mouseout" />
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

/* ─── Styles ─── */

const cardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '1.5rem',
};

const premiumBannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(0,123,255,0.04))',
  border: '1px solid rgba(0,229,255,0.2)',
};

const premiumBadgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: '#00E5FF',
  background: 'rgba(0,229,255,0.12)',
  border: '1px solid rgba(0,229,255,0.3)',
  borderRadius: '6px',
  padding: '0.2rem 0.5rem',
  whiteSpace: 'nowrap',
};

const quickStatsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  alignItems: 'center',
  marginTop: '0.75rem',
};

const panelCardStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--border-color)',
  borderRadius: '10px',
  padding: '1.25rem',
};

const panelTitleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.9rem',
  fontWeight: 700,
  marginBottom: '1rem',
};

const queryChipStyle: CSSProperties = {
  fontSize: '0.75rem',
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  background: 'rgba(0,229,255,0.08)',
  border: '1px solid rgba(0,229,255,0.15)',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};
