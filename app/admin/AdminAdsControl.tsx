'use client';

import { useState } from 'react';
import { toast } from '../../components/ui/Toast';
import { SponsorAdUnit } from '../../components/ads/SponsorAdUnit';
import { formatUsdAmount, calculateCtr, type SponsorAd } from '../../lib/ads';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Clock,
  DollarSign,
  Eye,
  MousePointerClick,
  Filter,
} from 'lucide-react';

interface AdminAdsControlProps {
  initialAds: SponsorAd[];
}

export function AdminAdsControl({ initialAds }: AdminAdsControlProps) {
  const [ads, setAds] = useState<SponsorAd[]>(initialAds || []);
  const [filter, setFilter] = useState<'pending' | 'active' | 'all'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const pendingAds = ads.filter((a) => a.status === 'pending_approval');
  const activeAds = ads.filter((a) => a.status === 'active');
  const filteredAds =
    filter === 'pending'
      ? pendingAds
      : filter === 'active'
      ? activeAds
      : ads;

  const totalRevenueCents = ads.reduce((sum, a) => sum + (a.amountPaidCents || 0), 0);
  const totalImpressionsServed = ads.reduce((sum, a) => sum + (a.impressionsServed || 0), 0);
  const totalClicks = ads.reduce((sum, a) => sum + (a.clicksCount || 0), 0);
  const overallCtr = calculateCtr(totalClicks, totalImpressionsServed);

  const handleAction = async (
    id: string,
    action: 'approve' | 'reject' | 'pause' | 'resume' | 'add_impressions' | 'delete',
    params?: any
  ) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/ads/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...params }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Action failed');
      }

      toast.success(`Ad ${action} successful`);

      // Update local state
      setAds((prev) =>
        prev
          .map((ad) => {
            if (ad.id !== id) return ad;
            if (action === 'approve' || action === 'resume') return { ...ad, status: 'active' as const };
            if (action === 'pause') return { ...ad, status: 'paused' as const };
            if (action === 'reject') return { ...ad, status: 'rejected' as const, rejectionReason: params?.reason };
            if (action === 'add_impressions') {
              return {
                ...ad,
                totalImpressionsPurchased: ad.totalImpressionsPurchased + (params?.bonusImpressions || 0),
                status: 'active' as const,
              };
            }
            return ad;
          })
          .filter((ad) => (action === 'delete' ? ad.id !== id : true))
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to perform action');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {/* Top Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="surface" style={{ borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total Ad Revenue</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-color)' }}>
            {formatUsdAmount(totalRevenueCents)}
          </div>
        </div>

        <div className="surface" style={{ borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Active Campaigns</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {activeAds.length}
          </div>
        </div>

        <div className="surface" style={{ borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Pending Review</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: pendingAds.length > 0 ? '#facc15' : 'var(--text-primary)' }}>
            {pendingAds.length}
          </div>
        </div>

        <div className="surface" style={{ borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Impressions Served</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalImpressionsServed.toLocaleString()}
          </div>
        </div>

        <div className="surface" style={{ borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Overall CTR</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-color)' }}>
            {overallCtr}% ({totalClicks} clicks)
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setFilter('pending')}
          className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          Pending Review ({pendingAds.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          Active ({activeAds.length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          All Campaigns ({ads.length})
        </button>
      </div>

      {/* Ads List */}
      {filteredAds.length === 0 ? (
        <div
          className="surface"
          style={{
            borderRadius: '14px',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
          }}
        >
          <Sparkles size={28} style={{ margin: '0 auto 0.75rem', color: 'var(--accent-color)', opacity: 0.7 }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            No campaigns in this view
          </div>
          <div style={{ fontSize: '0.85rem' }}>New ad submissions from /advertise will appear here for moderation.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredAds.map((ad) => {
            const isLoading = actionLoading === ad.id;
            const progress = Math.min(
              100,
              Number(((ad.impressionsServed / Math.max(1, ad.totalImpressionsPurchased)) * 100).toFixed(1))
            );
            const ctr = calculateCtr(ad.clicksCount, ad.impressionsServed);

            return (
              <div
                key={ad.id}
                className="surface"
                style={{
                  borderRadius: '16px',
                  padding: '1.5rem',
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                  alignItems: 'start',
                }}
              >
                {/* Left: Info & Moderation Details */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background:
                          ad.status === 'active'
                            ? 'rgba(34,197,94,0.15)'
                            : ad.status === 'pending_approval'
                            ? 'rgba(234,179,8,0.15)'
                            : 'rgba(148,163,184,0.15)',
                        color:
                          ad.status === 'active'
                            ? '#4ade80'
                            : ad.status === 'pending_approval'
                            ? '#facc15'
                            : '#94a3b8',
                      }}
                    >
                      {ad.status.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Placement: <strong style={{ color: 'var(--text-primary)' }}>{ad.placement}</strong>
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Bid: <strong style={{ color: 'var(--accent-color)' }}>${(ad.bidCpm / 100).toFixed(2)} CPM</strong>
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', fontWeight: 700 }}>{ad.title}</h3>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {ad.description}
                  </p>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    <div>
                      Target: <a href={ad.targetUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>{ad.targetUrl} <ExternalLink size={11} style={{ display: 'inline' }} /></a>
                    </div>
                    <div>
                      Advertiser: <span style={{ color: 'var(--text-primary)' }}>{ad.advertiserEmail}</span>
                    </div>
                    <div>
                      Paid: <strong style={{ color: 'var(--text-primary)' }}>{formatUsdAmount(ad.amountPaidCents || 0)}</strong> for {ad.totalImpressionsPurchased.toLocaleString()} impressions
                    </div>
                  </div>

                  {/* Delivery progress */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                      <span>Progress: {ad.impressionsServed.toLocaleString()} / {ad.totalImpressionsPurchased.toLocaleString()} views</span>
                      <span>{ad.clicksCount} clicks ({ctr}% CTR)</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', height: '6px', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--brand-gradient)', width: `${progress}%`, height: '100%' }} />
                    </div>
                  </div>

                  {/* Moderation Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {ad.status === 'pending_approval' && (
                      <>
                        <button
                          onClick={() => handleAction(ad.id, 'approve')}
                          disabled={isLoading}
                          className="btn btn-sm btn-primary"
                          style={{ gap: '4px' }}
                        >
                          <CheckCircle2 size={13} /> Approve &amp; Run
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Rejection reason:');
                            if (reason !== null) handleAction(ad.id, 'reject', { reason });
                          }}
                          disabled={isLoading}
                          className="btn btn-sm btn-secondary"
                          style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', gap: '4px' }}
                        >
                          <AlertTriangle size={13} /> Reject
                        </button>
                      </>
                    )}

                    {ad.status === 'active' && (
                      <button
                        onClick={() => handleAction(ad.id, 'pause')}
                        disabled={isLoading}
                        className="btn btn-sm btn-secondary"
                        style={{ gap: '4px' }}
                      >
                        <PauseCircle size={13} /> Pause
                      </button>
                    )}

                    {ad.status === 'paused' && (
                      <button
                        onClick={() => handleAction(ad.id, 'resume')}
                        disabled={isLoading}
                        className="btn btn-sm btn-primary"
                        style={{ gap: '4px' }}
                      >
                        <PlayCircle size={13} /> Resume
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const bonus = prompt('Enter bonus impressions to add (e.g. 5000):', '5000');
                        if (bonus) handleAction(ad.id, 'add_impressions', { bonusImpressions: parseInt(bonus, 10) });
                      }}
                      disabled={isLoading}
                      className="btn btn-sm btn-secondary"
                      style={{ gap: '4px' }}
                    >
                      <Plus size={13} /> Add Impressions
                    </button>

                    <button
                      onClick={() => {
                        if (confirm('Delete this ad campaign entirely?')) handleAction(ad.id, 'delete');
                      }}
                      disabled={isLoading}
                      className="btn btn-sm btn-secondary"
                      style={{ color: '#94a3b8' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Right: Live Preview Box */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Live Preview
                  </div>
                  <SponsorAdUnit
                    placement="directory_inline"
                    previewAd={{
                      title: ad.title,
                      description: ad.description,
                      ctaText: ad.ctaText,
                      targetUrl: ad.targetUrl,
                      logoUrl: ad.logoUrl,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
