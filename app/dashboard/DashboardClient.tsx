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
  logoUrl?: string | null;
  pendingLogoKey?: string | null;
  isPremium?: boolean;
  websiteVerified?: boolean;
  isOfficial?: boolean;
  reciprocalBadgeOk?: boolean;
  views?: number;
  copies?: number;
  upvotes?: number;
};

type Props = {
  initialServers: Server[];
  initialAnalytics?: Record<string, AnalyticsSummary>;
  isPremium?: boolean;
  /** Deep-links from a listing's "Manage listing" button (`/dashboard?edit=<id>`) straight into that listing's edit form. */
  initialEditId?: string | null;
};

export default function DashboardClient({ initialServers, initialAnalytics = {}, isPremium = false, initialEditId = null }: Props) {
  const [servers, setServers] = useState(initialServers);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailAnalytics, setDetailAnalytics] = useState<Record<string, ServerAnalytics>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', websiteUrl: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);

  const uploadLogo = async (serverId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo too large', { description: 'Must be 5MB or smaller.' });
      return;
    }
    setUploadingLogoId(serverId);
    try {
      const formData = new FormData();
      formData.append('id', serverId);
      formData.append('logo', file);
      const res = await fetch('/api/dashboard/logo', { method: 'POST', body: formData });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not upload logo');
      }
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, pendingLogoKey: 'pending' } : s))
      );
      toast.success('Logo submitted', { description: data.message || 'Awaiting review.' });
    } catch (err: any) {
      toast.error('Could not upload logo', { description: err?.message });
    } finally {
      setUploadingLogoId(null);
    }
  };

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

  useEffect(() => {
    if (!initialEditId) return;
    const target = servers.find((s) => s.id === initialEditId);
    if (!target) return;
    startEdit(target);
    document.getElementById(`server-${initialEditId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Only run once on mount — initialEditId comes from the server-rendered ?edit= param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 420, margin: '0 auto 1.25rem', lineHeight: 1.55 }}>
          Claim free, then add a dofollow AllMCPs badge on your site for a reciprocal SEO backlink.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
          <Link href="/browse" className="btn btn-primary">
            Browse &amp; claim your MCP
          </Link>
          <Link href="/badge-generator" className="btn btn-secondary">
            Badge generator
          </Link>
        </div>
      </div>
    );
  }

  const needsBacklinkHelp = servers.some(
    (s) => !s.isPremium && !s.reciprocalBadgeOk
  );

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

      {needsBacklinkHelp && (
        <div
          style={{
            padding: '1rem 1.15rem',
            borderRadius: 12,
            border: '1px solid rgba(16,185,129,0.35)',
            background: 'rgba(16,185,129,0.08)',
          }}
        >
          <p style={{ fontWeight: 700, color: '#34d399', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
            Free dofollow backlink available
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
            For each free listing below: attach a website → verify it → place a dofollow AllMCPs badge.
            We recheck the badge stays live. Premium listings get dofollow without a badge.
          </p>
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
          <div key={server.id} id={`server-${server.id}`} style={cardStyle}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {server.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={server.logoUrl}
                    alt={`${server.name} logo`}
                    width={40}
                    height={40}
                    style={{ borderRadius: 8, flexShrink: 0 }}
                  />
                )}
                <label
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {uploadingLogoId === server.id
                    ? 'Uploading…'
                    : server.pendingLogoKey
                    ? 'Logo pending review'
                    : server.logoUrl
                    ? 'Replace logo'
                    : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    style={{ display: 'none' }}
                    disabled={uploadingLogoId === server.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(server.id, file);
                      e.target.value = '';
                    }}
                  />
                </label>
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

            <BacklinkStatus server={server} />

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
                  detail.summary.totalApiHits === 0 && detail.summary.totalImpressions === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.55 }}>
                        Premium tracking is on — we just haven&apos;t seen API hits or directory
                        impressions yet. Share your listing, add the AllMCPs badge to your site, and
                        check back after agents discover you.
                      </p>
                      <Link
                        href={`/mcp/${server.id}`}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.85rem' }}
                      >
                        Open public listing
                      </Link>
                    </div>
                  ) : (
                    <AnalyticsPanel detail={detail} />
                  )
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
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => startEdit(server)}>
                  {pending ? 'Edit pending draft' : 'Edit'}
                </button>
                <Link href={`/mcp/${server.id}`} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                  View listing →
                </Link>
                <Link href={`/mcp/${server.id}/claim`} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                  Website &amp; verification
                </Link>
                <Link href="/badge-generator" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                  Badge code
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Per-listing SEO backlink checklist — drives free dofollow completion. */
function BacklinkStatus({ server }: { server: Server }) {
  const hasWebsite = Boolean(server.websiteUrl?.trim());
  const verified = Boolean(server.websiteVerified);
  const dofollow = Boolean(server.isPremium || server.reciprocalBadgeOk);

  if (dofollow) {
    return (
      <div
        style={{
          marginTop: '0.85rem',
          padding: '0.75rem 0.9rem',
          borderRadius: 10,
          border: '1px solid rgba(16,185,129,0.3)',
          background: 'rgba(16,185,129,0.08)',
          fontSize: '0.82rem',
          color: '#34d399',
          fontWeight: 600,
        }}
      >
        Website backlink is dofollow
        {server.isPremium ? ' (Premium)' : ' (reciprocal badge live)'}
      </div>
    );
  }

  const steps = [
    { done: hasWebsite, label: 'Website URL on listing' },
    { done: verified, label: 'Website verified (badge or DNS)' },
    { done: Boolean(server.reciprocalBadgeOk), label: 'Dofollow AllMCPs badge live on your site' },
  ];

  return (
    <div
      style={{
        marginTop: '0.85rem',
        padding: '0.85rem 0.95rem',
        borderRadius: 10,
        border: '1px solid rgba(0,229,255,0.28)',
        background: 'rgba(0,229,255,0.05)',
      }}
    >
      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#00E5FF', marginBottom: '0.45rem' }}>
        Free dofollow not active yet
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {steps.map((s) => (
          <li key={s.label}>
            <span style={{ color: s.done ? '#34d399' : 'var(--text-secondary)', marginRight: 6 }}>
              {s.done ? '✓' : '○'}
            </span>
            {s.label}
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link href={`/mcp/${server.id}/claim`} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
          Complete verification
        </Link>
        <Link href="/badge-generator" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
          Copy badge
        </Link>
      </div>
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
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.15, filter: 'blur(6px)',
        background: 'repeating-linear-gradient(90deg, #00E5FF 0px, #00E5FF 2px, transparent 2px, transparent 20px)',
      }} />

      <Lock size={32} style={{ color: '#00E5FF', marginBottom: '0.75rem', position: 'relative' }} />
      <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', position: 'relative' }}>Unlock Premium Analytics</h4>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '440px', margin: '0 auto 1rem', lineHeight: 1.55, position: 'relative' }}>
        Free dashboards show views, installs, and upvotes. Premium shows{' '}
        <strong style={{ color: 'var(--text-primary)' }}>which LLMs &amp; agents</strong> hit your
        listing, <strong style={{ color: 'var(--text-primary)' }}>where</strong> you appear in the
        directory, and <strong style={{ color: 'var(--text-primary)' }}>what searches</strong> find you —
        plus a dofollow website backlink.
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 auto 1.25rem',
          maxWidth: 360,
          textAlign: 'left',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.65,
          position: 'relative',
        }}
      >
        <li>✓ Caller breakdown (Claude, Cursor, ChatGPT, bots…)</li>
        <li>✓ Impression surfaces (browse, marquee, related, API)</li>
        <li>✓ Search queries that surface your MCP</li>
        <li>✓ Dofollow website link without a reciprocal badge</li>
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center', position: 'relative' }}>
        <Link href="/pricing" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={16} /> See Premium plans
        </Link>
        <Link
          href="/pricing#premium"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          Compare free vs Premium
        </Link>
      </div>
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
