'use client';

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import Link from 'next/link';
import { toast } from '@/components/ui/Toast';
import { parsePendingRevision } from '@/lib/pendingRevision';
import { CALLER_LABELS, CALLER_COLORS, type CallerClass } from '@/lib/accessLog';
import { SURFACE_LABELS, type ImpressionSurface } from '@/lib/impressionLog';
import type { AnalyticsSummary, ServerAnalytics } from '@/lib/analytics';
import { isFeaturedListing } from '@/lib/featuredStatus';
import { computeQualityScore, tierColor } from '@/lib/qualityScore';
import {
  Eye, Heart, Download, TrendingUp, TrendingDown, Minus,
  BarChart3, Search, Globe, Lock, Activity, Zap, Sparkles,
  Crown, MousePointerClick, CheckCircle2, AlertCircle, Edit3, Image as ImageIcon,
  Percent, MapPin, Award, ExternalLink, HelpCircle, ShieldCheck,
} from 'lucide-react';
import { DIRECTORY_CATEGORIES } from '@/lib/categories';
import { PremiumUpgrade } from '@/components/PremiumUpgrade';
import { MCP_CLIENTS } from '@/lib/clients';
import {
  AUTH_TYPES,
  AUTH_TYPE_LABELS,
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
  PRICING_MODELS,
  PRICING_MODEL_LABELS,
} from '@/lib/serverEnums';

type Server = {
  id: string;
  name: string;
  description: string;
  category: string;
  websiteUrl?: string | null;
  pendingRevision?: string | null;
  logoUrl?: string | null;
  pendingLogoKey?: string | null;
  screenshotUrl?: string | null;
  pendingScreenshotKey?: string | null;
  isPremium?: boolean;
  status?: string;
  featuredUntil?: string | null;
  categorySponsorUntil?: string | null;
  websiteVerified?: boolean;
  isOfficial?: boolean;
  reciprocalBadgeOk?: boolean;
  views?: number;
  copies?: number;
  upvotes?: number;
  healthStatus?: string | null;
  isVerifiedActive?: boolean | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
  tools?: string | null;
  url?: string;
  lastTweetedAt?: string | Date | null;
  tags?: string[] | null;
  pricingModel?: string | null;
  pricingNotes?: string | null;
  authType?: string | null;
  license?: string | null;
  compatibleClients?: string[] | null;
  maintenanceStatus?: string | null;
  supportUrl?: string | null;
  suggestedInstallCommand?: string | null;
  suggestedInstallArgs?: string[] | null;
};

type EditFormState = {
  name: string;
  description: string;
  category: string;
  websiteUrl: string;
  tagsInput: string;
  pricingModel: string;
  pricingNotes: string;
  authType: string;
  license: string;
  compatibleClients: string[];
  maintenanceStatus: string;
  supportUrl: string;
  suggestedInstallCommand: string;
  suggestedInstallArgsInput: string;
};

const emptyEditForm = (): EditFormState => ({
  name: '',
  description: '',
  category: '',
  websiteUrl: '',
  tagsInput: '',
  pricingModel: '',
  pricingNotes: '',
  authType: '',
  license: '',
  compatibleClients: [],
  maintenanceStatus: '',
  supportUrl: '',
  suggestedInstallCommand: '',
  suggestedInstallArgsInput: '',
});

type Props = {
  initialServers: Server[];
  initialAnalytics?: Record<string, AnalyticsSummary>;
  categoryRanks?: Record<string, { rank: number; totalInCategory: number }>;
  isPremium?: boolean;
  /** Deep-links from a listing's "Manage listing" button (`/dashboard?edit=<id>`) straight into that listing's edit form. */
  initialEditId?: string | null;
};

type TabType = 'overview' | 'seo' | 'boost' | 'edit';

export default function DashboardClient({
  initialServers,
  initialAnalytics = {},
  categoryRanks = {},
  isPremium = false,
  initialEditId = null,
}: Props) {
  const [servers, setServers] = useState(initialServers);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTabMap, setActiveTabMap] = useState<Record<string, TabType>>({});
  const [detailAnalytics, setDetailAnalytics] = useState<Record<string, ServerAnalytics>>({});
  const [loadingDetailMap, setLoadingDetailMap] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<EditFormState>(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const [uploadingScreenshotId, setUploadingScreenshotId] = useState<string | null>(null);

  // Compute aggregate stats across all claimed servers
  const totalViews = useMemo(() => servers.reduce((acc, s) => acc + (s.views || 0), 0), [servers]);
  const totalInstalls = useMemo(() => servers.reduce((acc, s) => acc + (s.copies || 0), 0), [servers]);
  const totalUpvotes = useMemo(() => servers.reduce((acc, s) => acc + (s.upvotes || 0), 0), [servers]);
  const totalApiHits = useMemo(() => Object.values(analytics).reduce((acc, a) => acc + (a.totalApiHits || 0), 0), [analytics]);
  const totalImpressions = useMemo(() => Object.values(analytics).reduce((acc, a) => acc + (a.totalImpressions || 0), 0), [analytics]);
  const totalOutboundClicks = useMemo(() => Object.values(analytics).reduce((acc, a) => acc + (a.totalOutboundClicks || 0), 0), [analytics]);

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
    const pending = parsePendingRevision(server.pendingRevision);
    const p = pending?.proposed;
    setForm({
      name: (p?.name as string) || server.name,
      description: (p?.description as string) || server.description,
      category: (p?.category as string) || server.category,
      websiteUrl: (p?.websiteUrl as string) || server.websiteUrl || '',
      tagsInput: ((p?.tags as string[]) || server.tags || []).join(', '),
      pricingModel: (p?.pricingModel as string) || server.pricingModel || '',
      pricingNotes: (p?.pricingNotes as string) || server.pricingNotes || '',
      authType: (p?.authType as string) || server.authType || '',
      license: (p?.license as string) || server.license || '',
      compatibleClients: (p?.compatibleClients as string[]) || server.compatibleClients || [],
      maintenanceStatus: (p?.maintenanceStatus as string) || server.maintenanceStatus || '',
      supportUrl: (p?.supportUrl as string) || server.supportUrl || '',
      suggestedInstallCommand:
        (p?.suggestedInstallCommand as string) || server.suggestedInstallCommand || '',
      suggestedInstallArgsInput: (
        (p?.suggestedInstallArgs as string[]) ||
        server.suggestedInstallArgs ||
        []
      ).join(' '),
    });
    setActiveTabMap((prev) => ({ ...prev, [server.id]: 'edit' }));
  };

  const uploadScreenshot = async (serverId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Screenshot too large', { description: 'Must be 5MB or smaller.' });
      return;
    }
    setUploadingScreenshotId(serverId);
    try {
      const formData = new FormData();
      formData.append('id', serverId);
      formData.append('screenshot', file);
      const res = await fetch('/api/dashboard/screenshot', { method: 'POST', body: formData });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || 'Could not upload screenshot');
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, pendingScreenshotKey: 'pending' } : s))
      );
      toast.success('Screenshot submitted', { description: data.message || 'Awaiting review.' });
    } catch (err: any) {
      toast.error('Could not upload screenshot', { description: err?.message });
    } finally {
      setUploadingScreenshotId(null);
    }
  };

  const submitEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const payload = {
        id: editingId,
        name: form.name,
        description: form.description,
        category: form.category,
        websiteUrl: form.websiteUrl,
        tags: form.tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        pricingModel: form.pricingModel || undefined,
        pricingNotes: form.pricingNotes || undefined,
        authType: form.authType || undefined,
        license: form.license || undefined,
        compatibleClients: form.compatibleClients,
        maintenanceStatus: form.maintenanceStatus || undefined,
        supportUrl: form.supportUrl || undefined,
        suggestedInstallCommand: form.suggestedInstallCommand || undefined,
        suggestedInstallArgs: form.suggestedInstallArgsInput
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await fetch('/api/dashboard/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit edit');
      }
      const submittedAt = new Date().toISOString();
      setServers((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? {
                ...s,
                pendingRevision: JSON.stringify({
                  proposed: {
                    ...payload,
                    websiteUrl: form.websiteUrl,
                  },
                  submittedAt,
                }),
              }
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

  // Auto-fetch deep analytics for all premium or boosted servers
  useEffect(() => {
    servers.forEach((server) => {
      const hasAccess = isFeaturedListing(server);
      if (hasAccess && !detailAnalytics[server.id] && !loadingDetailMap[server.id]) {
        setLoadingDetailMap((prev) => ({ ...prev, [server.id]: true }));
        fetch(`/api/dashboard/analytics?serverId=${server.id}`)
          .then((res) => (res.ok ? (res.json() as Promise<{ analytics: ServerAnalytics }>) : null))
          .then((data) => {
            if (data?.analytics) {
              setDetailAnalytics((prev) => ({ ...prev, [server.id]: data.analytics }));
            }
          })
          .catch(() => {})
          .finally(() => {
            setLoadingDetailMap((prev) => ({ ...prev, [server.id]: false }));
          });
      }
    });
  }, [servers, detailAnalytics, loadingDetailMap]);

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
      <div className="dashboard-empty">
        <div className="dashboard-empty-hero">
          <h2>No listings yet</h2>
          <p>
            Submit a new MCP server or claim one you already published. Once claimed, you get analytics,
            logo uploads, and free dofollow backlink setup.
          </p>
        </div>
        <ul className="dashboard-empty-grid" role="list">
          <li className="dashboard-empty-card">
            <h3>Submit a server</h3>
            <p>List a new repository or product site for free review.</p>
            <Link href="/submit" className="btn btn-primary">
              + Submit server
            </Link>
          </li>
          <li className="dashboard-empty-card">
            <h3>Claim an existing listing</h3>
            <p>Find your server in the directory and verify ownership via badge or DNS.</p>
            <Link href="/browse" className="btn btn-secondary">
              Browse directory
            </Link>
          </li>
          <li className="dashboard-empty-card">
            <h3>Get a badge</h3>
            <p>Generate README or site badges for verification and SEO.</p>
            <Link href="/badge-generator" className="btn btn-secondary">
              Badge generator
            </Link>
          </li>
        </ul>
      </div>
    );
  }

  const needsBacklinkHelp = servers.some((s) => !s.isPremium && !s.reciprocalBadgeOk);

  return (
    <div className="dashboard-workspace">
      <ul className="dashboard-metrics" role="list" aria-label="Portfolio summary">
        <li className="dashboard-metric">
          <span className="dashboard-metric-label">Listings</span>
          <span className="dashboard-metric-value">{servers.length}</span>
        </li>
        <li className="dashboard-metric">
          <span className="dashboard-metric-label">Views</span>
          <span className="dashboard-metric-value">{totalViews.toLocaleString()}</span>
        </li>
        <li className="dashboard-metric">
          <span className="dashboard-metric-label">Installs</span>
          <span className="dashboard-metric-value">{totalInstalls.toLocaleString()}</span>
        </li>
        <li className="dashboard-metric">
          <span className="dashboard-metric-label">Upvotes</span>
          <span className="dashboard-metric-value">{totalUpvotes.toLocaleString()}</span>
        </li>
        <li className="dashboard-metric dashboard-metric--accent">
          <span className="dashboard-metric-label">API hits (30d)</span>
          <span className="dashboard-metric-value">{totalApiHits.toLocaleString()}</span>
        </li>
        <li className="dashboard-metric">
          <span className="dashboard-metric-label">Impressions (30d)</span>
          <span className="dashboard-metric-value">{totalImpressions.toLocaleString()}</span>
        </li>
        <li className="dashboard-metric">
          <span className="dashboard-metric-label">Outbound clicks</span>
          <span className="dashboard-metric-value">{totalOutboundClicks.toLocaleString()}</span>
        </li>
      </ul>

      {isPremium && (
        <div className="dashboard-banner dashboard-banner--premium" role="status">
          <Zap size={16} aria-hidden="true" />
          <div>
            <strong>Premium analytics active</strong>
            <span> — full tracking across directory surfaces and agent traffic.</span>
          </div>
        </div>
      )}

      {needsBacklinkHelp && (
        <div className="dashboard-banner dashboard-banner--info" role="status">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>Free dofollow available</strong>
            <p>
              On each listing, finish setup: website → verify ownership → place the AllMCPs badge.
              Premium includes dofollow without a badge.
            </p>
          </div>
        </div>
      )}

      <ul className="dashboard-listing-list" role="list">
      {servers.map((server) => {
        const pending = parsePendingRevision(server.pendingRevision);
        const activeTab = getActiveTab(server.id);
        const isEditing = activeTab === 'edit';
        const summary = analytics[server.id];
        const detail = detailAnalytics[server.id];
        const isLoadingDetail = Boolean(loadingDetailMap[server.id]);
        const rankInfo = categoryRanks?.[server.id];
        const hasAnalyticsAccess = isFeaturedListing(server);
        const hasActiveBoost = !server.isPremium && hasAnalyticsAccess;

        let toolsCount = 0;
        if (server.tools) {
          try {
            const parsed = JSON.parse(server.tools);
            if (Array.isArray(parsed)) toolsCount = parsed.length;
          } catch {}
        }

        return (
          <li key={server.id} id={`server-${server.id}`} className="dashboard-listing-card">
            <div className="dashboard-listing-header">
              <div className="dashboard-listing-identity">
                {server.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={server.logoUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="dashboard-listing-logo"
                  />
                ) : (
                  <div className="dashboard-listing-logo-fallback" aria-hidden="true">
                    {server.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="dashboard-listing-identity-text">
                  <div className="dashboard-listing-title-row">
                    <h2>{server.name}</h2>
                    <span className="dashboard-pill">{server.category}</span>
                    {rankInfo && (
                      <span className="dashboard-pill dashboard-pill--rank">
                        #{rankInfo.rank} of {rankInfo.totalInCategory}
                      </span>
                    )}
                    {server.isPremium && <span className="dashboard-pill dashboard-pill--premium">Premium</span>}
                    {pending && <span className="dashboard-pill dashboard-pill--warn">Edit pending</span>}
                    {server.featuredUntil && new Date(server.featuredUntil).getTime() > Date.now() && (
                      <span className="dashboard-pill dashboard-pill--boost">
                        Boosted · {new Date(server.featuredUntil).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="dashboard-listing-id">
                    <code>{server.id}</code>
                    <span className="dashboard-listing-quick-stats">
                      {(server.views || 0).toLocaleString()} views · {(server.copies || 0).toLocaleString()} installs · {(server.upvotes || 0).toLocaleString()} upvotes
                      {server.githubStars != null && ` · ⭐ ${server.githubStars.toLocaleString()}`}
                      {server.npmDownloads != null && ` · 📦 ${server.npmDownloads.toLocaleString()}/mo`}
                      {toolsCount > 0 && ` · 🛠️ ${toolsCount} tools`}
                      {server.healthStatus && (
                        <span
                          style={{
                            marginLeft: '0.4rem',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '999px',
                            background: server.healthStatus === 'healthy' ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)',
                            color: server.healthStatus === 'healthy' ? '#34d399' : '#f59e0b',
                            border: `1px solid ${server.healthStatus === 'healthy' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
                          }}
                        >
                          {server.healthStatus === 'healthy' ? 'Healthy' : server.healthStatus}
                        </span>
                      )}
                    </span>
                  </p>
                </div>
              </div>

              <div className="dashboard-listing-actions">
                <Link
                  href={`/mcp/${server.id}`}
                  className="btn btn-secondary btn-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} aria-hidden="true" /> View listing
                </Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab(server.id, 'edit')}>
                  <Edit3 size={14} aria-hidden="true" /> Edit
                </button>
                <Link href={`/mcp/${server.id}/claim`} className="btn btn-secondary btn-sm">
                  Verify
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm dashboard-boost-btn"
                  onClick={() => setTab(server.id, 'boost')}
                >
                  <Sparkles size={14} aria-hidden="true" /> Boost
                </button>
                <label className="btn btn-secondary btn-sm dashboard-logo-upload">
                  <ImageIcon size={14} aria-hidden="true" />
                  {uploadingLogoId === server.id
                    ? 'Uploading…'
                    : server.pendingLogoKey
                      ? 'Logo pending'
                      : server.logoUrl
                        ? 'Replace logo'
                        : 'Upload logo'}
                  <input
                    id={`logo-input-${server.id}`}
                    type="file"
                    accept="image/png,image/jpeg"
                    disabled={uploadingLogoId === server.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(server.id, file);
                      e.target.value = '';
                    }}
                  />
                </label>
                <label className="btn btn-secondary btn-sm dashboard-logo-upload">
                  <ImageIcon size={14} aria-hidden="true" />
                  {uploadingScreenshotId === server.id
                    ? 'Uploading…'
                    : server.pendingScreenshotKey
                      ? 'Screenshot pending'
                      : server.screenshotUrl
                        ? 'Replace screenshot'
                        : 'Upload screenshot'}
                  <input
                    id={`screenshot-input-${server.id}`}
                    type="file"
                    accept="image/png,image/jpeg"
                    disabled={uploadingScreenshotId === server.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadScreenshot(server.id, file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <ListingSetupSteps
              server={server}
              onEdit={() => startEdit(server)}
              onUploadClick={() => {
                const input = document.getElementById(`logo-input-${server.id}`) as HTMLInputElement | null;
                input?.click();
              }}
            />

            <div className="dashboard-tabs" role="tablist" aria-label={`Sections for ${server.name}`}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                className={`dashboard-tab${activeTab === 'overview' ? ' is-active' : ''}`}
                onClick={() => setTab(server.id, 'overview')}
              >
                <BarChart3 size={15} aria-hidden="true" />
                Overview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'seo'}
                className={`dashboard-tab${activeTab === 'seo' ? ' is-active' : ''}`}
                onClick={() => setTab(server.id, 'seo')}
              >
                <Globe size={15} aria-hidden="true" />
                SEO
                {!server.isPremium && !server.reciprocalBadgeOk && (
                  <span className="dashboard-tab-dot" aria-label="Action needed" />
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'boost'}
                className={`dashboard-tab dashboard-tab--boost${activeTab === 'boost' ? ' is-active' : ''}`}
                onClick={() => setTab(server.id, 'boost')}
              >
                <Sparkles size={15} aria-hidden="true" />
                Boost
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'edit'}
                className={`dashboard-tab${activeTab === 'edit' ? ' is-active' : ''}`}
                onClick={() => setTab(server.id, 'edit')}
              >
                <Edit3 size={15} aria-hidden="true" />
                {pending ? 'Pending edit' : 'Edit'}
              </button>
            </div>

            {/* TAB CONTENT: Overview & Analytics */}
            {activeTab === 'overview' && (
              <div style={{ marginTop: '1.25rem' }}>
                <QualityScoreCard server={server} />

                <div style={quickStatsRowStyle}>
                  <StatPill icon={<Eye size={13} />} label="Views" value={server.views || 0} />
                  <StatPill icon={<Download size={13} />} label="Installs" value={server.copies || 0} />
                  <StatPill icon={<Heart size={13} />} label="Upvotes" value={server.upvotes || 0} />
                  {summary && (
                    <>
                      <StatPill icon={<Activity size={13} />} label="API Hits" value={summary.totalApiHits} accent trend={summary.trend} />
                      <StatPill icon={<Globe size={13} />} label="Impressions" value={summary.totalImpressions} accent />
                      <StatPill icon={<MousePointerClick size={13} />} label="Clicks" value={summary.totalOutboundClicks || 0} accent />
                      {summary.ctr != null && (
                        <StatPill icon={<Percent size={13} />} label="CTR" value={`${summary.ctr}%`} accent />
                      )}
                    </>
                  )}
                </div>

                <div style={{ marginTop: '1.25rem' }}>
                  {!hasAnalyticsAccess ? (
                    <PremiumTeaser />
                  ) : isLoadingDetail ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      <Activity size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      <p style={{ marginTop: '0.5rem' }}>Loading analytics…</p>
                    </div>
                  ) : detail ? (
                    <>
                      {hasActiveBoost && (
                        <div style={boostBannerStyle}>
                          <Sparkles size={16} color="#FACC15" />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, color: '#FACC15' }}>Active Boost Analytics Access</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '0.4rem' }}>
                              — Full analytics unlocked through your boost window! Upgrade to Premium for 24/7 perpetual analytics &amp; dofollow backlinks.
                            </span>
                          </div>
                          <Link href="/pricing" className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', flexShrink: 0 }}>
                            Upgrade to Premium →
                          </Link>
                        </div>
                      )}
                      {detail.summary.totalApiHits === 0 && detail.summary.totalImpressions === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.55 }}>
                            Analytics tracking is active — we just haven&apos;t seen API hits or directory impressions yet. Share your listing and check back after agents discover you.
                          </p>
                          <Link href={`/mcp/${server.id}`} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                            Open public listing
                          </Link>
                        </div>
                      ) : (
                        <AnalyticsPanel detail={detail} lastTweetedAt={server.lastTweetedAt} />
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                      No analytics data yet. Data will appear as LLMs and users interact with your listing.
                    </p>
                  )}
                </div>
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
                    <span className="dashboard-pill dashboard-pill--boost">
                      Active until {new Date(server.featuredUntil).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <PremiumUpgrade
                  serverId={server.id}
                  listingStatus={server.status || 'active'}
                  isPremium={server.isPremium}
                  featuredUntil={server.featuredUntil}
                  categorySponsorUntil={server.categorySponsorUntil}
                  compact
                  showAll
                />
              </div>
            )}

            {/* TAB CONTENT: Edit Details */}
            {activeTab === 'edit' && (
              <div className="dashboard-edit-form">
                <p className="submit-hint" style={{ marginBottom: '0.25rem' }}>
                  Changes go to admin review before they go live
                  {pending ? ' — you already have a pending edit; submitting again replaces it.' : '.'}
                </p>
                <div>
                  <label style={fieldLabelStyle}>Server name</label>
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
                <div className="submit-optional-grid">
                  <div>
                    <label style={fieldLabelStyle}>Category</label>
                    <select
                      className="form-input"
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    >
                      {(!form.category || DIRECTORY_CATEGORIES.includes(form.category)
                        ? DIRECTORY_CATEGORIES
                        : [form.category, ...DIRECTORY_CATEGORIES]
                      ).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
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
                </div>

                <div>
                  <label style={fieldLabelStyle}>Tags (comma-separated, up to 5)</label>
                  <input
                    className="form-input"
                    value={form.tagsInput}
                    onChange={(e) => setForm((f) => ({ ...f, tagsInput: e.target.value }))}
                    placeholder="sql, database, read-only"
                  />
                </div>

                <div className="submit-optional-grid">
                  <div>
                    <label style={fieldLabelStyle}>Pricing</label>
                    <select
                      className="form-input"
                      value={form.pricingModel}
                      onChange={(e) => setForm((f) => ({ ...f, pricingModel: e.target.value }))}
                    >
                      <option value="">Not specified</option>
                      {PRICING_MODELS.map((p) => (
                        <option key={p} value={p}>
                          {PRICING_MODEL_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Auth</label>
                    <select
                      className="form-input"
                      value={form.authType}
                      onChange={(e) => setForm((f) => ({ ...f, authType: e.target.value }))}
                    >
                      <option value="">Not specified</option>
                      {AUTH_TYPES.map((a) => (
                        <option key={a} value={a}>
                          {AUTH_TYPE_LABELS[a]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Maintenance</label>
                    <select
                      className="form-input"
                      value={form.maintenanceStatus}
                      onChange={(e) => setForm((f) => ({ ...f, maintenanceStatus: e.target.value }))}
                    >
                      <option value="">Not specified</option>
                      {MAINTENANCE_STATUSES.map((m) => (
                        <option key={m} value={m}>
                          {MAINTENANCE_STATUS_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>License</label>
                    <input
                      className="form-input"
                      value={form.license}
                      onChange={(e) => setForm((f) => ({ ...f, license: e.target.value }))}
                      placeholder="MIT"
                    />
                  </div>
                </div>

                {form.pricingModel && form.pricingModel !== 'free' && (
                  <div>
                    <label style={fieldLabelStyle}>Pricing notes</label>
                    <input
                      className="form-input"
                      value={form.pricingNotes}
                      onChange={(e) => setForm((f) => ({ ...f, pricingNotes: e.target.value }))}
                      placeholder="Free tier limits, plan pricing…"
                    />
                  </div>
                )}

                <div>
                  <label style={fieldLabelStyle}>Support / community URL</label>
                  <input
                    className="form-input"
                    type="url"
                    value={form.supportUrl}
                    onChange={(e) => setForm((f) => ({ ...f, supportUrl: e.target.value }))}
                    placeholder="https://discord.gg/…"
                  />
                </div>

                <div>
                  <label style={fieldLabelStyle}>Compatible clients</label>
                  <div className="submit-client-checks">
                    {MCP_CLIENTS.map((c) => {
                      const checked = form.compatibleClients.includes(c.slug);
                      return (
                        <label key={c.slug} className="submit-client-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                compatibleClients: e.target.checked
                                  ? [...f.compatibleClients, c.slug]
                                  : f.compatibleClients.filter((s) => s !== c.slug),
                              }))
                            }
                          />
                          {c.name}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="submit-optional-grid">
                  <div>
                    <label style={fieldLabelStyle}>Suggested install command</label>
                    <input
                      className="form-input"
                      value={form.suggestedInstallCommand}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, suggestedInstallCommand: e.target.value }))
                      }
                      placeholder="npx"
                    />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Suggested install args</label>
                    <input
                      className="form-input"
                      value={form.suggestedInstallArgsInput}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, suggestedInstallArgsInput: e.target.value }))
                      }
                      placeholder="-y @scope/pkg"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" disabled={saving} onClick={submitEdit}>
                    {saving ? 'Submitting…' : pending ? 'Update pending edit' : 'Submit for review'}
                  </button>
                  <button
                    type="button"
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

type SetupStep = {
  id: string;
  done: boolean;
  pending?: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
};

/**
 * Clean setup path for each listing: progress bar + numbered steps with CTAs.
 * Replaces the old green-text checklist wall.
 */
function ListingSetupSteps({
  server,
  onEdit,
  onUploadClick,
}: {
  server: Server;
  onEdit: () => void;
  onUploadClick: () => void;
}) {
  const steps: SetupStep[] = [
    {
      id: 'logo',
      done: Boolean(server.logoUrl),
      pending: Boolean(server.pendingLogoKey) && !server.logoUrl,
      title: server.logoUrl
        ? 'Logo live'
        : server.pendingLogoKey
          ? 'Logo pending review'
          : 'Add a logo',
      description: server.logoUrl
        ? 'Your listing card shows a custom logo in the directory.'
        : server.pendingLogoKey
          ? 'We received your upload — it goes live after admin review.'
          : 'A logo makes your card stand out in browse and search results.',
      actionLabel: server.logoUrl || server.pendingLogoKey ? undefined : 'Upload logo',
      onAction: server.logoUrl || server.pendingLogoKey ? undefined : onUploadClick,
    },
    {
      id: 'website',
      done: Boolean(server.websiteUrl?.trim()),
      title: server.websiteUrl?.trim() ? 'Website URL set' : 'Add your website URL',
      description: server.websiteUrl?.trim()
        ? 'Visitors can open your product site from the listing.'
        : 'Required for ownership verification and the free dofollow backlink.',
      actionLabel: server.websiteUrl?.trim() ? undefined : 'Edit listing',
      onAction: server.websiteUrl?.trim() ? undefined : onEdit,
    },
    {
      id: 'verify',
      done: Boolean(server.websiteVerified),
      title: server.websiteVerified ? 'Website verified' : 'Verify website ownership',
      description: server.websiteVerified
        ? 'Ownership is confirmed — badge and DNS checks passed.'
        : 'Prove you control the site via badge, meta tag, or DNS TXT.',
      actionLabel: server.websiteVerified ? undefined : 'Verify now',
      href: server.websiteVerified ? undefined : `/mcp/${server.id}/claim`,
    },
    {
      id: 'badge',
      done: Boolean(server.reciprocalBadgeOk || server.isPremium),
      title: server.isPremium
        ? 'Dofollow included (Premium)'
        : server.reciprocalBadgeOk
          ? 'AllMCPs badge live'
          : 'Place the AllMCPs badge',
      description: server.isPremium
        ? 'Premium listings get a dofollow website link without a reciprocal badge.'
        : server.reciprocalBadgeOk
          ? 'We detected your badge — your website link is dofollow.'
          : 'Embed the free dofollow badge on your site to unlock SEO value.',
      actionLabel:
        server.reciprocalBadgeOk || server.isPremium ? undefined : 'Get badge code',
      href: server.reciprocalBadgeOk || server.isPremium ? undefined : '/badge-generator',
    },
    {
      id: 'status',
      done: server.status === 'active',
      title:
        server.status === 'active'
          ? 'Listing is live'
          : `Listing status: ${server.status || 'unknown'}`,
      description:
        server.status === 'active'
          ? 'Your server is published and indexable in the directory.'
          : 'Only active listings appear in search and the public directory.',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;
  const progressPct = Math.round((doneCount / total) * 100);
  const nextStep = steps.find((s) => !s.done && !s.pending) || steps.find((s) => !s.done);

  return (
    <section
      className={`listing-setup${allDone ? ' listing-setup--complete' : ''}`}
      aria-label={`Setup progress for ${server.name}`}
    >
      <div className="listing-setup-header">
        <div className="listing-setup-header-text">
          <h3 className="listing-setup-title">
            {allDone ? 'Listing setup complete' : 'Finish listing setup'}
          </h3>
          <p className="listing-setup-subtitle">
            {allDone
              ? 'Everything looks good — keep an eye on analytics and boosts below.'
              : nextStep
                ? `Next: ${nextStep.title}`
                : 'Complete the remaining steps to unlock SEO and trust signals.'}
          </p>
        </div>
        <div className="listing-setup-progress-meta" aria-hidden={false}>
          <span className="listing-setup-count">
            {doneCount}/{total}
          </span>
          <span className="listing-setup-count-label">done</span>
        </div>
      </div>

      <div
        className="listing-setup-progress-track"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${doneCount} of ${total} setup steps complete`}
      >
        <div className="listing-setup-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <ol className="listing-setup-steps">
        {steps.map((step, index) => {
          const state = step.done ? 'done' : step.pending ? 'pending' : 'todo';
          return (
            <li key={step.id} className={`listing-setup-step listing-setup-step--${state}`}>
              <div className="listing-setup-step-marker" aria-hidden="true">
                {step.done ? (
                  <CheckCircle2 size={18} strokeWidth={2.25} />
                ) : step.pending ? (
                  <span className="listing-setup-step-num listing-setup-step-num--pending">…</span>
                ) : (
                  <span className="listing-setup-step-num">{index + 1}</span>
                )}
              </div>
              <div className="listing-setup-step-body">
                <div className="listing-setup-step-title-row">
                  <span className="listing-setup-step-title">{step.title}</span>
                  {step.done && (
                    <span className="listing-setup-step-badge listing-setup-step-badge--done">Done</span>
                  )}
                  {step.pending && (
                    <span className="listing-setup-step-badge listing-setup-step-badge--pending">
                      Pending
                    </span>
                  )}
                </div>
                <p className="listing-setup-step-desc">{step.description}</p>
                {(step.href || step.onAction) && step.actionLabel && (
                  <div className="listing-setup-step-actions">
                    {step.href ? (
                      <Link href={step.href} className="btn btn-primary listing-setup-step-cta">
                        {step.actionLabel}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary listing-setup-step-cta"
                        onClick={step.onAction}
                      >
                        {step.actionLabel}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
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
        <AlertCircle size={18} style={{ color: 'var(--accent-color)' }} />
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-color)' }}>
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

function TwitterIcon({ size = 16, color = '#1DA1F2' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}

function StatPill({ icon, label, value, accent, trend }: { icon: React.ReactNode; label: string; value: number | string; accent?: boolean; trend?: 'up' | 'down' | 'flat' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.4rem',
      background: accent ? 'rgba(var(--accent-rgb), 0.08)' : 'rgba(255,255,255,0.03)',
      padding: '0.6rem 0.75rem', borderRadius: '10px', minWidth: 0,
      border: `1px solid ${accent ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--border-color)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0, height: '1rem' }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0,
          fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: accent ? 'var(--accent-color)' : 'var(--text-secondary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1, color: accent ? 'var(--accent-color)' : 'var(--text-primary)' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {trend && <TrendIndicator trend={trend} compact />}
      </div>
    </div>
  );
}

const TREND_CONFIG = {
  up: { Icon: TrendingUp, color: '#059669', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', label: 'Trending up', shortLabel: 'Up' },
  down: { Icon: TrendingDown, color: '#DC2626', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', label: 'Trending down', shortLabel: 'Down' },
  flat: { Icon: Minus, color: 'var(--text-secondary)', bg: 'rgba(148,163,184,0.14)', border: 'var(--border-color)', label: 'Stable', shortLabel: 'Stable' },
} as const;

function TrendIndicator({ trend, compact }: { trend: 'up' | 'down' | 'flat'; compact?: boolean }) {
  const { Icon, color, bg, border, label, shortLabel } = TREND_CONFIG[trend];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      fontSize: compact ? '0.65rem' : '0.75rem', color, fontWeight: 700,
      background: bg, border: `1px solid ${border}`, borderRadius: '999px',
      padding: compact ? '0.12rem 0.4rem' : '0.25rem 0.6rem', whiteSpace: 'nowrap',
    }} title={label}>
      <Icon size={compact ? 11 : 14} />
      {compact ? shortLabel : label}
    </div>
  );
}

function PremiumTeaser() {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: '12px',
      border: '1px solid rgba(var(--accent-rgb), 0.3)',
      background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.06), rgba(var(--accent-secondary-rgb), 0.04))',
      padding: '2rem', textAlign: 'center',
    }}>
      <Lock size={32} style={{ color: 'var(--accent-color)', marginBottom: '0.75rem', position: 'relative' }} />
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

function AnalyticsPanel({ detail, lastTweetedAt }: { detail: ServerAnalytics; lastTweetedAt?: string | Date | null }) {
  return (
    <div style={{
      display: 'grid', gap: '1.25rem',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    }}>
      {/* LLM Caller Breakdown */}
      <div style={panelCardStyle}>
        <h3 style={panelTitleStyle}>
          <BarChart3 size={16} style={{ color: 'var(--accent-color)' }} />
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
          <Eye size={16} style={{ color: 'var(--accent-color)' }} />
          Where Users Discover You
        </h3>
        {(() => {
          const directorySurfaces = detail.bySurface.filter(
            (s) => s.surface !== 'outbound_github' && s.surface !== 'outbound_website'
          );
          const totalDir = directorySurfaces.reduce((s, r) => s + r.impressions, 0);
          if (directorySurfaces.length === 0) {
            return <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No impression data yet.</p>;
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {directorySurfaces.map((row) => (
                <SurfaceBar
                  key={row.surface}
                  surface={row.surface as ImpressionSurface}
                  impressions={row.impressions}
                  total={totalDir}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* External Outbound Clicks */}
      <div style={panelCardStyle}>
        <h3 style={panelTitleStyle}>
          <MousePointerClick size={16} style={{ color: 'var(--accent-color)' }} />
          External Link Clicks
        </h3>
        {(() => {
          const externalSurfaces = detail.bySurface.filter(
            (s) => s.surface === 'outbound_github' || s.surface === 'outbound_website'
          );
          const totalClicks = externalSurfaces.reduce((s, r) => s + r.impressions, 0);
          if (externalSurfaces.length === 0) {
            return (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Tracks outbound clicks when visitors on your listing detail page click out to your GitHub repository or product website.
              </p>
            );
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {externalSurfaces.map((row) => (
                <SurfaceBar
                  key={row.surface}
                  surface={row.surface as ImpressionSurface}
                  impressions={row.impressions}
                  total={totalClicks}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Geographic Traffic Distribution */}
      <div style={panelCardStyle}>
        <h3 style={panelTitleStyle}>
          <Globe size={16} style={{ color: 'var(--accent-color)' }} />
          Traffic by Country / Region
        </h3>
        {(!detail.byCountry || detail.byCountry.length === 0) ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No geographic data yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {detail.byCountry.map((row) => (
              <CountryBar key={row.country} country={row.country} hits={row.hits} pct={row.pct} />
            ))}
          </div>
        )}
      </div>

      {/* X / Twitter Spotlight Status */}
      <div style={panelCardStyle}>
        <h3 style={panelTitleStyle}>
          <TwitterIcon size={16} color="#1DA1F2" />
          X / Twitter Spotlight Status
        </h3>
        {detail.recentTweet ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.04)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontStyle: 'italic', lineHeight: 1.5 }}>
              &ldquo;{detail.recentTweet.tweetText}&rdquo;
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span>
                {detail.recentTweet.status === 'sent'
                  ? `Highlighted on ${new Date(detail.recentTweet.sentAt || Date.now()).toLocaleDateString()}`
                  : 'Queued for @AllMCPs spotlight rotation'}
              </span>
              <a href="https://x.com/AllMCPs" target="_blank" rel="noopener noreferrer" style={{ color: '#1DA1F2', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                View on @AllMCPs <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ) : lastTweetedAt ? (
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <p style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              ✓ Highlighted on @AllMCPs on {new Date(lastTweetedAt).toLocaleDateString()}
            </p>
            <a href="https://x.com/AllMCPs" target="_blank" rel="noopener noreferrer" style={{ color: '#1DA1F2', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}>
              View on @AllMCPs X feed → <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            <p style={{ margin: '0 0 0.5rem' }}>
              Queued for upcoming spotlight rotation. Periodic highlights run via our RSS feed and automated spotlight queue.
            </p>
            <a href="https://x.com/AllMCPs" target="_blank" rel="noopener noreferrer" style={{ color: '#1DA1F2', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}>
              Follow @AllMCPs on X → <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      {/* API Endpoints Requested */}
      <div style={panelCardStyle}>
        <h3 style={panelTitleStyle}>
          <Zap size={16} style={{ color: 'var(--accent-color)' }} />
          API Endpoints Requested
        </h3>
        {(!detail.byEndpoint || detail.byEndpoint.length === 0) ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No endpoint access data yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {detail.byEndpoint.map((row) => (
              <EndpointBar
                key={row.endpoint}
                endpoint={row.endpoint}
                hits={row.hits}
                total={detail.summary.totalApiHits || 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Daily Activity Sparkline */}
      <div style={panelCardStyle}>
        <h3 style={panelTitleStyle}>
          <Activity size={16} style={{ color: 'var(--accent-color)' }} />
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
          <Search size={16} style={{ color: 'var(--accent-color)' }} />
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

const ENDPOINT_LABELS: Record<string, string> = {
  v1_mcp_detail: 'MCP Server Detail API',
  v1_search: 'MCP Search API',
  v1_tools: 'MCP Tools Schema API',
  v1_servers: 'MCP Servers List API',
  mcp_page: 'Listing Detail View',
};

function EndpointBar({ endpoint, hits, total }: { endpoint: string; hits: number; total: number }) {
  const label = ENDPOINT_LABELS[endpoint] || endpoint;
  const pct = total > 0 ? Math.round((hits / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{hits.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(128, 128, 128, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          width: `${Math.max(pct, 2)}%`,
          background: 'linear-gradient(90deg, #A855F7, #EC4899)',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function CountryBar({ country, hits, pct }: { country: string; hits: number; pct: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>📍 {country}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{hits.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(128, 128, 128, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          width: `${Math.max(pct, 2)}%`,
          background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function QualityScoreCard({ server }: { server: Server }) {
  const quality = computeQualityScore(server as any);
  const color = tierColor(quality.tier);

  // Actionable tips to improve quality score
  const tips: string[] = [];
  if (!server.isOfficial && !server.websiteVerified && !server.isPremium) {
    tips.push('Claim ownership or verify your domain (+20 pts)');
  }
  if (!server.tools || server.tools === '[]') {
    tips.push('Document callable MCP tools & schemas (+30 pts)');
  }
  if (!server.websiteUrl) {
    tips.push('Attach your product website URL (+10 pts)');
  }
  if ((server.description || '').trim().length < 300) {
    tips.push('Expand description to 300+ characters (+15 pts)');
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '1.15rem 1.25rem',
      marginBottom: '1.25rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} style={{ color }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            Listing Quality Score
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {quality.score}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/100</span>
          </span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700, color,
            background: `${color}22`, border: `1px solid ${color}55`,
            borderRadius: '999px', padding: '0.2rem 0.65rem',
          }}>
            {quality.tier}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(128, 128, 128, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: tips.length > 0 ? '0.85rem' : '0' }}>
        <div style={{
          height: '100%', borderRadius: '4px',
          width: `${quality.score}%`,
          background: color,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Actionable Tips */}
      {tips.length > 0 && (
        <div style={{ background: 'rgba(var(--accent-rgb), 0.05)', border: '1px solid rgba(var(--accent-rgb), 0.15)', borderRadius: '8px', padding: '0.75rem 0.85rem', marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-color)', margin: '0 0 0.35rem' }}>
            💡 Tips to Improve Your Score:
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
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
      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(128, 128, 128, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
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
      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(128, 128, 128, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          width: `${Math.max(pct, 2)}%`,
          background: 'linear-gradient(90deg, var(--accent-color), var(--accent-secondary))',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function Sparkline({ data, labels }: { data: number[]; labels: string[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const totalHits = data.reduce((a, b) => a + b, 0);
  const peakHits = Math.max(...data, 0);
  const avgHits = Math.round((totalHits / Math.max(data.length, 1)) * 10) / 10;

  const width = 360;
  const height = 110;
  const paddingX = 12;
  const paddingTop = 12;
  const paddingBottom = 20;
  const chartHeight = height - paddingTop - paddingBottom;
  const max = Math.max(peakHits, 1);
  const step = (width - paddingX * 2) / Math.max(data.length - 1, 1);

  const points = data.map((v, i) => ({
    x: paddingX + i * step,
    y: paddingTop + chartHeight - (v / max) * chartHeight,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${paddingTop + chartHeight} L ${paddingX} ${paddingTop + chartHeight} Z`;

  const activeIndex = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length ? hoverIndex : null;
  const activePoint = activeIndex !== null ? points[activeIndex] : null;

  return (
    <div style={{ width: '100%' }}>
      {/* Chart Summary Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', padding: '0 0.1rem' }}>
        <div>
          <span>30d Total: </span>
          <strong style={{ color: 'var(--text-primary)' }}>{totalHits.toLocaleString()}</strong>
        </div>
        <div>
          <span>Peak: </span>
          <strong style={{ color: '#F43F5E' }}>{peakHits.toLocaleString()}</strong>
          <span style={{ margin: '0 0.3rem', opacity: 0.4 }}>|</span>
          <span>Avg: </span>
          <strong style={{ color: 'var(--accent-color)' }}>{avgHits}</strong>/day
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingTop} x2={width - paddingX} y2={paddingTop} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1={paddingX} y1={paddingTop + chartHeight / 2} x2={width - paddingX} y2={paddingTop + chartHeight / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1={paddingX} y1={paddingTop + chartHeight} x2={width - paddingX} y2={paddingTop + chartHeight} stroke="rgba(255,255,255,0.12)" />

          {/* Area under curve */}
          <path d={areaD} fill="url(#chartGrad)" />

          {/* Main stroke line */}
          <path d={pathD} fill="none" stroke="var(--accent-color)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Hover highlight line and point */}
          {activePoint && (
            <>
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={paddingTop + chartHeight}
                stroke="rgba(var(--accent-rgb), 0.5)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="5"
                fill="var(--accent-color)"
                stroke="var(--bg-elevated, #0f172a)"
                strokeWidth="2"
              />
            </>
          )}

          {/* Invisible hover trigger columns for smooth mouse interaction */}
          {points.map((p, i) => {
            const colWidth = step;
            const xLeft = p.x - colWidth / 2;
            return (
              <rect
                key={i}
                x={xLeft}
                y={paddingTop}
                width={colWidth}
                height={chartHeight}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoverIndex(i)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip display */}
        {activeIndex !== null && activePoint && (
          <div
            style={{
              position: 'absolute',
              top: Math.max(0, activePoint.y * (110 / height) - 45),
              left: `${Math.min(85, Math.max(15, (activePoint.x / width) * 100))}%`,
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(var(--accent-rgb), 0.4)',
              borderRadius: '6px',
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              color: '#F8FAFC',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--accent-color)' }}>
              {data[activeIndex].toLocaleString()} hits
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              {labels[activeIndex]}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.3rem', padding: '0 0.1rem' }}>
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

/* ─── Styles ─── */

const globalSummaryContainerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(172px, 1fr))',
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

// Fixed height + nowrap/ellipsis so every card's label occupies identical
// vertical space regardless of text length — otherwise a longer label (e.g.
// "Claimed Listings") wraps to two lines on narrow cards and pushes that
// card's number down relative to its neighbors.
const summaryLabelStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
  height: '1rem',
  lineHeight: '1rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const summaryValueStyle: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 800,
  color: 'var(--text-primary)',
  lineHeight: 1.2,
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
  background: 'rgba(var(--accent-rgb), 0.1)',
  border: '1px solid rgba(var(--accent-rgb), 0.25)',
  color: 'var(--accent-color)',
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
  background: 'rgba(128, 128, 128, 0.12)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)',
};

const rankBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  background: 'rgba(245, 158, 11, 0.15)',
  border: '1px solid rgba(245, 158, 11, 0.4)',
  color: '#d97706',
};

const pendingBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  background: 'rgba(245, 158, 11, 0.15)',
  border: '1px solid rgba(245, 158, 11, 0.4)',
  color: '#d97706',
};

const boostBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  background: 'rgba(var(--accent-rgb), 0.12)',
  border: '1px solid rgba(var(--accent-rgb), 0.3)',
  color: 'var(--accent-color)',
};

const premiumBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--accent-color)',
  background: 'rgba(var(--accent-rgb), 0.12)',
  border: '1px solid rgba(var(--accent-rgb), 0.3)',
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
    background: isActive ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
    color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
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
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
  gap: '0.6rem',
};

const boostBannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.85rem 1.15rem',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.12), rgba(245, 158, 11, 0.06))',
  border: '1px solid rgba(250, 204, 21, 0.3)',
  marginBottom: '1.25rem',
  flexWrap: 'wrap',
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
  background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.08), rgba(var(--accent-secondary-rgb), 0.04))',
  border: '1px solid rgba(var(--accent-rgb), 0.2)',
};

const backlinkAlertBannerStyle: CSSProperties = {
  padding: '1rem 1.15rem',
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--accent-color) 30%, var(--border-color))',
  background: 'color-mix(in srgb, var(--accent-color) 8%, var(--bg-elevated))',
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
  border: '1px solid rgba(var(--accent-rgb), 0.28)',
  background: 'rgba(var(--accent-rgb), 0.05)',
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
  background: 'rgba(var(--accent-rgb), 0.08)',
  border: '1px solid rgba(var(--accent-rgb), 0.15)',
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
