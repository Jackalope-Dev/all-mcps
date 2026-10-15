'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { SponsorAdUnit } from '../../components/ads/SponsorAdUnit';
import { toast } from '../../components/ui/Toast';
import {
  adRevisionToDbPatch,
  type EditableAdFields,
  parseAdRevision,
} from '../../lib/adRevision';
import { calculateCtr, formatUsdAmount, type SponsorAd } from '../../lib/ads';
import { AdminEmpty } from './AdminUi';

const AD_FIELD_LABELS: Record<keyof EditableAdFields, string> = {
  title: 'Title',
  description: 'Description',
  ctaText: 'Button text',
  targetUrl: 'Destination URL',
};

/** Status pill hue: running green, awaiting review amber, rejected red. */
const AD_STATUS_HUE: Record<SponsorAd['status'], string> = {
  active: 'hue-green',
  pending_approval: 'hue-amber',
  rejected: 'hue-red',
  paused: '',
  completed: 'hue-blue',
};

interface AdminAdsControlProps {
  initialAds: SponsorAd[];
}

export function AdminAdsControl({ initialAds }: AdminAdsControlProps) {
  const [ads, setAds] = useState<SponsorAd[]>(initialAds || []);
  const [filter, setFilter] = useState<'pending' | 'edits' | 'active' | 'all'>(
    'pending',
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const pendingAds = ads.filter((a) => a.status === 'pending_approval');
  const activeAds = ads.filter((a) => a.status === 'active');
  const editAds = ads.filter((a) => parseAdRevision(a.pendingRevision));
  const filteredAds =
    filter === 'pending'
      ? pendingAds
      : filter === 'edits'
        ? editAds
        : filter === 'active'
          ? activeAds
          : ads;

  const totalRevenueCents = ads.reduce(
    (sum, a) => sum + (a.amountPaidCents || 0),
    0,
  );
  const totalImpressionsServed = ads.reduce(
    (sum, a) => sum + (a.impressionsServed || 0),
    0,
  );
  const totalClicks = ads.reduce((sum, a) => sum + (a.clicksCount || 0), 0);
  const overallCtr = calculateCtr(totalClicks, totalImpressionsServed);

  const handleAction = async (
    id: string,
    action:
      | 'approve'
      | 'reject'
      | 'pause'
      | 'resume'
      | 'add_impressions'
      | 'approve_edit'
      | 'reject_edit'
      | 'delete',
    params?: any,
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
            if (action === 'approve' || action === 'resume')
              return { ...ad, status: 'active' as const };
            if (action === 'pause') return { ...ad, status: 'paused' as const };
            if (action === 'reject')
              return {
                ...ad,
                status: 'rejected' as const,
                rejectionReason: params?.reason,
              };
            if (action === 'approve_edit') {
              const revision = parseAdRevision(ad.pendingRevision);
              return {
                ...ad,
                ...(revision ? adRevisionToDbPatch(revision.proposed) : {}),
                pendingRevision: null,
              };
            }
            if (action === 'reject_edit')
              return { ...ad, pendingRevision: null };
            if (action === 'add_impressions') {
              return {
                ...ad,
                totalImpressionsPurchased:
                  ad.totalImpressionsPurchased +
                  (params?.bonusImpressions || 0),
                status: 'active' as const,
              };
            }
            return ad;
          })
          .filter((ad) => (action === 'delete' ? ad.id !== id : true)),
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to perform action');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="adm-stack">
      {/* Top metrics strip */}
      <dl className="adm-metrics">
        <div className="adm-metric is-accent">
          <dt>Total ad revenue</dt>
          <dd>{formatUsdAmount(totalRevenueCents)}</dd>
        </div>
        <div className="adm-metric">
          <dt>Active campaigns</dt>
          <dd>{activeAds.length}</dd>
        </div>
        <div
          className={`adm-metric${pendingAds.length > 0 ? ' is-accent hue-amber' : ''}`}
        >
          <dt>Pending review</dt>
          <dd>{pendingAds.length}</dd>
        </div>
        <div className="adm-metric">
          <dt>Impressions served</dt>
          <dd>{totalImpressionsServed.toLocaleString()}</dd>
        </div>
        <div className="adm-metric">
          <dt>Overall CTR</dt>
          <dd>
            {overallCtr}% <small>({totalClicks} clicks)</small>
          </dd>
        </div>
      </dl>

      {/* Filter */}
      <div className="adm-chip-row scroll-x fade-x">
        {(
          [
            ['pending', 'Pending review', pendingAds.length],
            ['edits', 'Edits', editAds.length],
            ['active', 'Active', activeAds.length],
            ['all', 'All campaigns', ads.length],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className="chip"
            aria-pressed={filter === value}
          >
            {label}
            <span className="chip-count">{count}</span>
          </button>
        ))}
      </div>

      {/* Ads list */}
      {filteredAds.length === 0 ? (
        <AdminEmpty
          icon={Megaphone}
          title="No campaigns in this view"
          hue="hue-cyan"
          boxed
        >
          New ad submissions from /advertise will appear here for moderation.
        </AdminEmpty>
      ) : (
        <div className="adm-stack">
          {filteredAds.map((ad) => {
            const isLoading = actionLoading === ad.id;
            const progress = Math.min(
              100,
              Number(
                (
                  (ad.impressionsServed /
                    Math.max(1, ad.totalImpressionsPurchased)) *
                  100
                ).toFixed(1),
              ),
            );
            const ctr = calculateCtr(ad.clicksCount, ad.impressionsServed);

            return (
              <article
                key={ad.id}
                className={`adm-ad${isLoading ? ' is-busy' : ''}`}
              >
                {/* Left: info & moderation */}
                <div className="adm-ad-main">
                  <div className="adm-ad-tags">
                    <span
                      className={`adm-tag is-dot ${AD_STATUS_HUE[ad.status]}`}
                    >
                      {ad.status.replace('_', ' ')}
                    </span>
                    <span>
                      Placement <strong>{ad.placement}</strong>
                    </span>
                    <span>
                      Bid{' '}
                      <strong className="adm-accent">
                        ${(ad.bidCpm / 100).toFixed(2)} CPM
                      </strong>
                    </span>
                    {!ad.stripePaymentIntentId && (
                      <span className="adm-tag hue-red">
                        <AlertTriangle size={11} aria-hidden="true" /> Payment
                        unverified
                      </span>
                    )}
                  </div>

                  <h3 className="adm-ad-title">{ad.title}</h3>
                  <p className="adm-ad-desc">{ad.description}</p>

                  <dl className="adm-kv">
                    <div>
                      <dt>Target</dt>
                      <dd>
                        <a
                          href={ad.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="adm-link adm-link--wrap"
                        >
                          {ad.targetUrl}{' '}
                          <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt>Advertiser</dt>
                      <dd>{ad.advertiserEmail}</dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd>
                        <strong>
                          {formatUsdAmount(ad.amountPaidCents || 0)}
                        </strong>{' '}
                        for {ad.totalImpressionsPurchased.toLocaleString()}{' '}
                        impressions
                      </dd>
                    </div>
                  </dl>

                  {/* Delivery progress */}
                  <div className="adm-progress-block">
                    <div className="adm-progress-head">
                      <span>
                        {ad.impressionsServed.toLocaleString()} /{' '}
                        {ad.totalImpressionsPurchased.toLocaleString()} views
                      </span>
                      <span>
                        {ad.clicksCount} clicks ({ctr}% CTR)
                      </span>
                    </div>
                    <div
                      className="adm-progress"
                      role="progressbar"
                      aria-label="Impressions delivered"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <PendingAdEdit
                    ad={ad}
                    disabled={isLoading}
                    onApprove={() => handleAction(ad.id, 'approve_edit')}
                    onReject={() => {
                      const reason = prompt(
                        'Why are these changes not approved? (included in the advertiser email; leave blank for the default)',
                      );
                      if (reason !== null)
                        handleAction(
                          ad.id,
                          'reject_edit',
                          reason ? { reason } : undefined,
                        );
                    }}
                  />

                  {/* Moderation actions */}
                  <div className="adm-actions">
                    {ad.status === 'pending_approval' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAction(ad.id, 'approve')}
                          disabled={isLoading || !ad.stripePaymentIntentId}
                          className="btn btn-sm adm-btn-tint hue-green"
                          title={
                            !ad.stripePaymentIntentId
                              ? 'Payment not yet confirmed by Stripe webhook'
                              : undefined
                          }
                        >
                          <CheckCircle2 size={14} aria-hidden="true" /> Approve
                          &amp; run
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = prompt('Rejection reason:');
                            if (reason !== null)
                              handleAction(ad.id, 'reject', { reason });
                          }}
                          disabled={isLoading}
                          className="btn btn-sm adm-btn-tint hue-red"
                        >
                          <AlertTriangle size={14} aria-hidden="true" /> Reject
                        </button>
                      </>
                    )}

                    {ad.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          const reason = prompt(
                            'Reason for pausing (optional — included in the advertiser email):',
                          );
                          if (reason !== null)
                            handleAction(
                              ad.id,
                              'pause',
                              reason ? { reason } : undefined,
                            );
                        }}
                        disabled={isLoading}
                        className="btn btn-sm btn-secondary"
                      >
                        <PauseCircle size={14} aria-hidden="true" /> Pause
                      </button>
                    )}

                    {ad.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => handleAction(ad.id, 'resume')}
                        disabled={isLoading}
                        className="btn btn-sm adm-btn-tint hue-green"
                      >
                        <PlayCircle size={14} aria-hidden="true" /> Resume
                      </button>
                    )}

                    {!!ad.stripePaymentIntentId &&
                      ad.status !== 'pending_approval' &&
                      ad.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => {
                            const bonus = prompt(
                              'Enter bonus impressions to add (e.g. 5000):',
                              '5000',
                            );
                            if (bonus)
                              handleAction(ad.id, 'add_impressions', {
                                bonusImpressions: parseInt(bonus, 10),
                              });
                          }}
                          disabled={isLoading}
                          className="btn btn-sm btn-secondary"
                        >
                          <Plus size={14} aria-hidden="true" /> Add impressions
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this ad campaign entirely?'))
                          handleAction(ad.id, 'delete');
                      }}
                      disabled={
                        isLoading ||
                        (!!ad.stripePaymentIntentId &&
                          (ad.status === 'active' || ad.status === 'paused'))
                      }
                      className="btn btn-sm btn-ghost"
                      aria-label="Delete campaign"
                      title={
                        ad.stripePaymentIntentId &&
                        (ad.status === 'active' || ad.status === 'paused')
                          ? 'Paid and still running — reject it first to issue a refund, then delete'
                          : 'Delete campaign'
                      }
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Right: live preview */}
                <div className="adm-ad-preview">
                  <div className="adm-preview-label">Live preview</div>
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Advertiser-proposed copy/link edit: field diff, preview and approve/reject. */
function PendingAdEdit({
  ad,
  disabled,
  onApprove,
  onReject,
}: {
  ad: SponsorAd;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const revision = parseAdRevision(ad.pendingRevision);
  if (!revision) return null;
  const proposed = adRevisionToDbPatch(revision.proposed);
  const keys = Object.keys(proposed) as (keyof EditableAdFields)[];

  return (
    <div className="adm-callout">
      <div>
        <div className="adm-callout-title">
          Pending edit · submitted{' '}
          {new Date(revision.submittedAt).toLocaleString()}
        </div>
        <div className="adm-callout-sub">
          Delivery is unaffected: placement, bid and impressions stay as they
          are.
        </div>
      </div>
      <dl className="adm-diff">
        {keys.map((key) => (
          <div key={key}>
            <dt className="adm-diff-key">{AD_FIELD_LABELS[key]}</dt>
            <dd>
              <div className="adm-diff-old">{ad[key]}</div>
              <div className="adm-diff-new">{proposed[key]}</div>
            </dd>
          </div>
        ))}
      </dl>
      <SponsorAdUnit
        placement="directory_inline"
        previewAd={{
          title: proposed.title ?? ad.title,
          description: proposed.description ?? ad.description,
          ctaText: proposed.ctaText ?? ad.ctaText,
          targetUrl: proposed.targetUrl ?? ad.targetUrl,
          logoUrl: ad.logoUrl,
        }}
      />
      <div className="adm-actions">
        <button
          type="button"
          onClick={onApprove}
          disabled={disabled}
          className="btn btn-sm adm-btn-tint hue-green"
        >
          <CheckCircle2 size={14} aria-hidden="true" /> Approve edit
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={disabled}
          className="btn btn-sm adm-btn-tint hue-red"
        >
          <AlertTriangle size={14} aria-hidden="true" /> Reject edit
        </button>
      </div>
    </div>
  );
}
