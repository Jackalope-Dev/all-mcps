'use client';

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import Link from 'next/link';
import { toast } from '@/components/ui/Toast';
import { parsePendingRevision } from '@/lib/pendingRevision';
import { CALLER_LABELS, CALLER_COLORS, type CallerClass } from '@/lib/accessLog';
import { SURFACE_LABELS, type ImpressionSurface } from '@/lib/impressionLog';
import type { AnalyticsSummary, ServerAnalytics } from '@/lib/analytics';
import {
  Eye, Heart, Download, TrendingUp, TrendingDown, Minus,
  BarChart3, Search, Globe, Lock, ChevronDown, ChevronUp,
  Activity, Zap, Sparkles, Crown, MousePointerClick, CheckCircle2, AlertCircle, Edit3, Image as ImageIcon,
} from 'lucide-react';
import { PremiumUpgrade } from '@/components/PremiumUpgrade';

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
  status?: string;
  featuredUntil?: string | null;
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

type TabType = 'overview' | 'seo' | 'boost' | 'edit';

export default function DashboardClient({ initialServers, initialAnalytics = {}, isPremium = false, initialEditId = null }: Props) {
  const [servers, setServers] = useState(initialServers);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTabMap, setActiveTabMap] = useState<Record<string, TabType>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailAnalytics, setDetailAnalytics] = useState<Record<string, ServerAnalytics>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', websiteUrl: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);

  // Compute aggregate stats across all claimed servers
  const totalViews = useMemo(() => servers.reduce((acc, s) => acc + (s.views || 0), 0), [servers]);
  const totalInstalls = useMemo(() => servers.reduce((acc, s) => acc + (s.copies || 0), 0), [servers]);
  const totalUpvotes = useMemo(() => servers.reduce((acc, s) => acc + (s.upvotes || 0), 0), [servers]);
  const totalApiHits = useMemo(() => Object.values(analytics).reduce((acc, a) => acc + (a.totalApiHits || 0), 0), [analytics]);

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
    setActiveTabMap((prev) => ({ ...prev, [server.id]: 'edit' }));
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
      setActiveTabMap((prev) => ({ ...prev, [editingId]: 'overview' }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpand = async (serverId: string) => {
    if (expandedId === serverId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(serverId);

    const server = servers.find((s) => s.id === serverId);
    if (!server?.isPremium) return;
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

  const getActiveTab = (serverId: string): TabType => {
    if (editingId === serverId) return 'edit';
    return activeTabMap[serverId] || 'overview';
  };

  const setTab = (serverId: string, tab: TabType) => {
    if (tab === 'edit') {
      const s = servers.find((srv) => srv.id === serverId);
      if (s) startEdit(s);
    } else {
      if (editingId === serverId) {
        setEditingId(null);
      }
    }
    setActiveTabMap((prev) => ({ ...prev, [serverId]: tab }));
  };

  if (servers.length === 0) {
    return (
      <div style={emptyStateCardStyle}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚀</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Welcome to Your Developer Workspace
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 520, margin: '0 auto 2rem', lineHeight: 1.6 }}>
          Claim ownership of your Model Context Protocol servers to access detailed LLM usage analytics, earn reciprocal dofollow SEO backlinks, and boost listing discovery.
        </p>
        <ul role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', maxWidth: 840, margin: '0 auto', listStyle: 'none', padding: 0 }}>
          <li style={onboardingActionCardStyle}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>➕</div>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>Submit a New Server</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.55 }}>
              List a new MCP server repository or product website in our directory.
            </p>
            <Link href="/submit" className="btn btn-primary" style={{ fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}>
              + Submit Server
            </Link>
          </li>

          <li style={onboardingActionCardStyle}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔎</div>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>Claim Existing Server</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.55 }}>
              Find your server in the directory and claim ownership via GitHub README or DNS.
            </p>
            <Link href="/browse" className="btn btn-secondary" style={{ fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}>
              Browse &amp; Claim →
            </Link>
          </li>

          <li style={onboardingActionCardStyle}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🛡️</div>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>Embed SVG Badge</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.55 }}>
              Generate dynamic SVG verification badges for your GitHub README or site.
            </p>
            <Link href="/badge-generator" className="btn btn-secondary" style={{ fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}>
              Badge Generator →
            </Link>
          </li>
        </ul>
      </div>
    );
  }

  const needsBacklinkHelp = servers.some((s) => !s.isPremium && !s.reciprocalBadgeOk);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Aggregate Metrics Overview Header */}
      <ul role="list" style={{ ...globalSummaryContainerStyle, listStyle: 'none', margin: 0, padding: 0 }}>
        <li style={summaryMetricCardStyle}>
          <span style={summaryLabelStyle}>Claimed Listings</span>
          <span style={summaryValueStyle}>{servers.length}</span>
        </li>
        <li style={summaryMetricCardStyle}>
          <span style={summaryLabelStyle}>Total Views</span>
          <span style={summaryValueStyle}>{totalViews.toLocaleString()}</span>
        </li>
        <li style={summaryMetricCardStyle}>
          <span style={summaryLabelStyle}>Total Installs</span>
          <span style={summaryValueStyle}>{totalInstalls.toLocaleString()}</span>
        </li>
        <li style={summaryMetricCardStyle}>
          <span style={summaryLabelStyle}>Total Upvotes</span>
          <span style={summaryValueStyle}>{totalUpvotes.toLocaleString()}</span>
        </li>
        <li style={summaryMetricCardStyle}>
          <span style={summaryLabelStyle}>API Hits (30d)</span>
          <span style={{ ...summaryValueStyle, color: '#00E5FF' }}>{totalApiHits.toLocaleString()}</span>
        </li>
      </ul>

      {/* Global stats / alerts */}
      {isPremium && (
        <div style={premiumBannerStyle}>
          <Zap size={16} style={{ color: '#00E5FF' }} />
          <span style={{ fontWeight: 600, color: '#00E5FF' }}>Premium Analytics Active</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            — Your listings are tracked across all directory surfaces &amp; LLM agents
          </span>
        </div>
      )}

      {needsBacklinkHelp && (
        <div style={backlinkAlertBannerStyle}>
          <p style={{ fontWeight: 700, color: '#34d399', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
            Free dofollow backlink available
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
            For each free listing below: attach a website → verify it → place a dofollow AllMCPs badge.
            We recheck that the badge stays live. Premium listings get dofollow without a badge.
          </p>
        </div>
      )}

      {/* Servers list with tabbed sections */}
      <ul role="list" style={{ display: 'contents', listStyle: 'none', margin: 0, padding: 0 }}>
      {servers.map((server) => {
        const pending = parsePendingRevision(server.pendingRevision);
        const activeTab = getActiveTab(server.id);
        const isEditing = activeTab === 'edit';
        const isExpanded = expandedId === server.id;
        const summary = analytics[server.id];
        const detail = detailAnalytics[server.id];
        const isLoadingDetail = loadingDetail === server.id;

        return (
          <li key={server.id} id={`server-${server.id}`} style={cardStyle}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                {server.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={server.logoUrl}
                    alt={`${server.name} logo`}
                    width={44}
                    height={44}
                    style={{ borderRadius: 10, flexShrink: 0, objectFit: 'cover' }}
                  />
                ) : (
                  <div style={logoPlaceholderStyle}>
                    {server.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{server.name}</h2>
                    <span style={categoryBadgeStyle}>{server.category}</span>
                    {server.isPremium && <span style={premiumBadgeStyle}>★ Premium</span>}
                    {pending && <span style={pendingBadgeStyle}>Awaiting Review</span>}
                    {server.featuredUntil && new Date(server.featuredUntil).getTime() > Date.now() && (
                      <span style={boostBadgeStyle}>⚡ Active Boost</span>
                    )}
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ID: <code style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{server.id}</code>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <ImageIcon size={14} />
                  {uploadingLogoId === server.id
                    ? 'Uploading…'
                    : server.pendingLogoKey
                    ? 'Logo pending'
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
                <Link
                  href={`/mcp/${server.id}`}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                >
                  View listing →
                </Link>
                <Link
                  href={`/mcp/${server.id}/claim`}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                >
                  Website &amp; Verification
                </Link>
              </div>
            </div>

            {/* Tab Navigation Controls */}
            <div style={tabContainerStyle}>
              <button
                type="button"
                onClick={() => setTab(server.id, 'overview')}
                style={getTabButtonStyle(activeTab === 'overview')}
              >
                <BarChart3 size={15} />
                Overview &amp; Analytics
              </button>
              <button
                type="button"
                onClick={() => setTab(server.id, 'seo')}
                style={getTabButtonStyle(activeTab === 'seo')}
              >
                <Globe size={15} />
                SEO &amp; Dofollow Status
                {!server.isPremium && !server.reciprocalBadgeOk && (
                  <span style={tabBadgeAlertStyle} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab(server.id, 'boost')}
                style={getTabButtonStyle(activeTab === 'boost')}
              >
                <Sparkles size={15} />
                Boost &amp; Sponsorship
              </button>
              <button
                type="button"
                onClick={() => setTab(server.id, 'edit')}
                style={getTabButtonStyle(activeTab === 'edit')}
              >
                <Edit3 size={15} />
                {pending ? 'Edit pending draft' : 'Edit details'}
              </button>
            </div>

            {/* TAB CONTENT: Overview & Analytics */}
            {activeTab === 'overview' && (
              <div style={{ marginTop: '1.25rem' }}>
                <div style={quickStatsRowStyle}>
                  <StatPill icon={<Eye size={13} />} label="Views" value={server.views || 0} />
                  <StatPill icon={<Download size={13} />} label="Installs" value={server.copies || 0} />
                  <StatPill icon={<Heart size={13} />} label="Upvotes" value={server.upvotes || 0} />
                  {summary && (
                    <>
                      <StatPill icon={<Activity size={13} />} label="API Hits" value={summary.totalApiHits} accent />
                      <StatPill icon={<Globe size={13} />} label="Impressions" value={summary.totalImpressions} accent />
                      <StatPill icon={<MousePointerClick size={13} />} label="Clicks" value={summary.totalOutboundClicks || 0} accent />
                      <TrendIndicator trend={summary.trend} />
                    </>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', marginLeft: 'auto' }}
                    onClick={() => toggleExpand(server.id)}
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {isExpanded ? 'Hide Deep Analytics' : 'Deep Analytics'}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '1.25rem' }}>
                    {!server.isPremium ? (
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
                            Premium tracking is on — we just haven&apos;t seen API hits or directory impressions yet. Share your listing and check back after agents discover you.
                          </p>
                          <Link href={`/mcp/${server.id}`} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
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
              </div>
            )}

            {/* TAB CONTENT: SEO & Dofollow Checklist */}
            {activeTab === 'seo' && (
              <div style={{ marginTop: '1.25rem' }}>
                <BacklinkStatus server={server} />
              </div>
            )}

            {/* TAB CONTENT: Boost & Sponsorship */}
            {activeTab === 'boost' && (
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={18} color="var(--accent-color)" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      Listing Boost &amp; Spotlight Options
                    </span>
                  </div>
                  {server.featuredUntil && new Date(server.featuredUntil).getTime() > Date.now() && (
                    <span style={boostBadgeStyle}>
                      ★ Active Boost until {new Date(server.featuredUntil).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <PremiumUpgrade serverId={server.id} listingStatus={server.status || 'active'} isPremium={server.isPremium} compact showAll />
              </div>
            )}

            {/* TAB CONTENT: Edit Details */}
            {activeTab === 'edit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem' }}>
                <div>
                  <label style={fieldLabelStyle}>Server Name</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Description</label>
                  <textarea
                    className="form-input"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Description"
                    rows={4}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Category</label>
                  <input
                    className="form-input"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="Category"
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Website URL</label>
                  <input
                    className="form-input"
                    type="url"
                    value={form.websiteUrl}
                    onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                    placeholder="https://yoursite.com"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn btn-primary" disabled={saving} onClick={submitEdit}>
                    {saving ? 'Submitting…' : pending ? 'Update pending edit' : 'Submit for review'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={saving}
                    onClick={() => {
                      setEditingId(null);
                      setTab(server.id, 'overview');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
      </ul>
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
      <div style={backlinkActiveContainerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <CheckCircle2 size={18} style={{ color: '#34d399' }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#34d399' }}>
            Website backlink is active dofollow
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {server.isPremium
            ? 'Your website link passes full SEO authority as part of your Premium Plan.'
            : 'Your reciprocal AllMCPs badge is live and passes full SEO authority.'}
        </p>
      </div>
    );
  }

  const steps = [
    { done: hasWebsite, label: 'Website URL added to listing' },
    { done: verified, label: 'Website ownership verified (badge, meta tag, or DNS)' },
    { done: Boolean(server.reciprocalBadgeOk), label: 'Dofollow AllMCPs badge live on your site' },
  ];

  return (
    <div style={backlinkPendingContainerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <AlertCircle size={18} style={{ color: '#00E5FF' }} />
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#00E5FF' }}>
          Free dofollow backlink setup checklist
        </span>
      </div>
      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        Complete these 3 steps to convert your listing&apos;s website link into a reciprocal dofollow backlink:
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        {steps.map((s, idx) => (
          <li key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: '50%',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: s.done ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.08)',
                color: s.done ? '#34d399' : 'var(--text-secondary)',
                border: `1px solid ${s.done ? 'rgba(52,211,153,0.4)' : 'var(--border-color)'}`,
              }}
            >
              {s.done ? '✓' : idx + 1}
            </span>
            <span style={{ color: s.done ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: s.done ? 600 : 400 }}>
              {s.label}
            </span>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link href={`/mcp/${server.id}/claim`} className="btn btn-primary" style={{ fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}>
          Complete verification →
        </Link>
        <Link href="/badge-generator" className="btn btn-secondary" style={{ fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}>
          Copy badge snippet
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
      padding: '0.35rem 0.65rem', borderRadius: '8px',
      border: `1px solid ${accent ? 'rgba(0,229,255,0.2)' : 'var(--border-color)'}`,
    }}>
      {icon}
      <span style={{ fontWeight: 700, color: accent ? '#00E5FF' : 'var(--text-primary)' }}>
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
      <Lock size={32} style={{ color: '#00E5FF', marginBottom: '0.75rem', position: 'relative' }} />
      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', position: 'relative', color: 'var(--text-primary)' }}>Unlock Premium Analytics</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto 1rem', lineHeight: 1.55, position: 'relative' }}>
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
        <h3 style={panelTitleStyle}>
          <BarChart3 size={16} style={{ color: '#00E5FF' }} />
          Which LLMs Use Your MCP
        </h3>
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
        <h3 style={panelTitleStyle}>
          <Eye size={16} style={{ color: '#00E5FF' }} />
          Where Users See You
        </h3>
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
        <h3 style={panelTitleStyle}>
          <Activity size={16} style={{ color: '#00E5FF' }} />
          Daily API Activity (30 days)
        </h3>
        {detail.byDay.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No daily data yet.</p>
        ) : (
          <Sparkline data={detail.byDay.map((d) => d.hits)} labels={detail.byDay.map((d) => d.date)} />
        )}
      </div>

      {/* Search Discovery */}
      <div style={panelCardStyle}>
        <h3 style={panelTitleStyle}>
          <Search size={16} style={{ color: '#00E5FF' }} />
          Search Queries That Find You
        </h3>
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
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
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
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
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

const globalSummaryContainerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '1rem',
};

const summaryMetricCardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '1rem 1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const summaryLabelStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
};

const summaryValueStyle: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 800,
  color: 'var(--text-primary)',
};

const cardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '14px',
  padding: '1.5rem',
};

const logoPlaceholderStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  background: 'rgba(0,229,255,0.1)',
  border: '1px solid rgba(0,229,255,0.25)',
  color: '#00E5FF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '1.2rem',
  flexShrink: 0,
};

const categoryBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)',
};

const pendingBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  background: 'rgba(251,191,36,0.12)',
  border: '1px solid rgba(251,191,36,0.3)',
  color: '#fbbf24',
};

const boostBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  background: 'rgba(0,229,255,0.12)',
  border: '1px solid rgba(0,229,255,0.3)',
  color: '#00E5FF',
};

const premiumBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#00E5FF',
  background: 'rgba(0,229,255,0.12)',
  border: '1px solid rgba(0,229,255,0.3)',
  borderRadius: '6px',
  padding: '0.25rem 0.6rem',
  whiteSpace: 'nowrap',
};

const tabContainerStyle: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '0.5rem',
  overflowX: 'auto',
};

function getTabButtonStyle(isActive: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '8px',
    border: 'none',
    background: isActive ? 'rgba(0,229,255,0.12)' : 'transparent',
    color: isActive ? '#00E5FF' : 'var(--text-secondary)',
    fontWeight: isActive ? 700 : 500,
    fontSize: '0.825rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  };
}

const tabBadgeAlertStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#34d399',
  display: 'inline-block',
};

const quickStatsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  alignItems: 'center',
};

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '0.4rem',
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

const backlinkAlertBannerStyle: CSSProperties = {
  padding: '1rem 1.15rem',
  borderRadius: 12,
  border: '1px solid rgba(16,185,129,0.35)',
  background: 'rgba(16,185,129,0.08)',
};

const backlinkActiveContainerStyle: CSSProperties = {
  padding: '1rem 1.15rem',
  borderRadius: 12,
  border: '1px solid rgba(16,185,129,0.35)',
  background: 'rgba(16,185,129,0.08)',
};

const backlinkPendingContainerStyle: CSSProperties = {
  padding: '1.15rem',
  borderRadius: 12,
  border: '1px solid rgba(0,229,255,0.28)',
  background: 'rgba(0,229,255,0.05)',
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
  color: 'var(--text-primary)',
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

const emptyStateCardStyle: CSSProperties = {
  textAlign: 'center',
  padding: '3.5rem 1.5rem',
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
};

const onboardingActionCardStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '1.25rem',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};
