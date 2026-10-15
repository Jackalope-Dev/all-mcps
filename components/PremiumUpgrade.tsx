'use client';

import { Crown, Loader2, Minus, Plus, Sparkles, Zap } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { trackBeginCheckout } from '../lib/gtag';
import {
  formatUsd,
  PAID_PRODUCTS,
  type PaidSku,
  tieredSavingsPct,
  tieredTotal,
} from '../lib/pricing';
import { toast } from './ui/Toast';

type Props = {
  serverId: string;
  /** pending listings can buy priority; active can buy featured/premium */
  listingStatus?: string;
  isPremium?: boolean;
  hasStripeCustomer?: boolean;
  compact?: boolean;
  /** Show every SKU (pricing page); API still enforces listing status. */
  showAll?: boolean;
  /** SKU the user picked before finding their listing (e.g. from a pricing card CTA) — sorted first and visually emphasized. */
  highlightSku?: PaidSku | null;
  /** Current featured/category-sponsor expiry, if any — lets the weeks stepper preview the resulting end date (purchases stack onto remaining time rather than replacing it). */
  featuredUntil?: string | Date | null;
  categorySponsorUntil?: string | Date | null;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

const ICONS: Record<PaidSku, ReactNode> = {
  priority_review: <Zap size={18} />,
  featured_7d: <Sparkles size={18} />,
  category_sponsor_7d: <Crown size={18} />,
  premium_monthly: <Crown size={18} />,
};

export function PremiumUpgrade({
  serverId,
  listingStatus = 'active',
  isPremium = false,
  hasStripeCustomer = false,
  compact = false,
  showAll = false,
  highlightSku = null,
  featuredUntil = null,
  categorySponsorUntil = null,
}: Props) {
  const [loadingSku, setLoadingSku] = useState<PaidSku | null>(null);
  const [weeksBySku, setWeeksBySku] = useState<
    Partial<Record<PaidSku, number>>
  >({});

  const getWeeks = (sku: PaidSku) => weeksBySku[sku] ?? 1;
  const setWeeks = (sku: PaidSku, weeks: number, maxWeeks: number) =>
    setWeeksBySku((prev) => ({
      ...prev,
      [sku]: Math.min(maxWeeks, Math.max(1, weeks)),
    }));

  // Purchases stack onto remaining active time rather than replacing it (see the webhook),
  // so "buy N weeks" only tells half the story — show what date it actually runs until.
  const resultDateFor = (sku: PaidSku, weeks: number): Date => {
    const current =
      sku === 'category_sponsor_7d' ? categorySponsorUntil : featuredUntil;
    const currentMs = current ? new Date(current).getTime() : 0;
    const base = currentMs > Date.now() ? new Date(currentMs) : new Date();
    return new Date(base.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  };

  const visible = (Object.keys(PAID_PRODUCTS) as PaidSku[])
    .filter((sku) => {
      if (sku === 'category_sponsor_7d') return false;
      if (showAll) return !(sku === 'premium_monthly' && isPremium);
      if (sku === 'priority_review') return listingStatus === 'pending';
      if (sku === 'premium_monthly' && isPremium) return false;
      return listingStatus === 'active';
    })
    .sort((a, b) => (a === highlightSku ? -1 : b === highlightSku ? 1 : 0));

  const canManageBilling = isPremium || hasStripeCustomer;

  // The SKU the user picked from a pricing card CTA may not be purchasable yet
  // (e.g. Featured needs an active listing, this one is still pending review) —
  // surface why instead of silently dropping their choice from the list.
  const highlightUnavailableReason =
    highlightSku && !visible.includes(highlightSku)
      ? highlightSku === 'premium_monthly' && isPremium
        ? 'This listing is already Premium.'
        : highlightSku === 'priority_review'
          ? 'Priority Review is only for listings still in the review queue — this one is already published.'
          : 'This upgrade needs an active, published listing — finish the free review first, or buy Priority Review to speed that up.'
      : null;

  if (visible.length === 0 && !canManageBilling && !highlightUnavailableReason)
    return null;

  const startCheckout = async (sku: PaidSku, weeks?: number) => {
    setLoadingSku(sku);
    trackBeginCheckout({ sku, serverId });
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, sku, ...(weeks ? { weeks } : {}) }),
        signal: AbortSignal.timeout(20000),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        hint?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(
          [data.error, data.hint].filter(Boolean).join(' ') ||
            'Checkout unavailable',
        );
      }
      window.location.href = data.url;
    } catch (e: any) {
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      toast.error('Could not start checkout', {
        description: timedOut
          ? 'The request timed out. Please try again.'
          : e?.message || 'Stripe may not be configured yet.',
      });
      setLoadingSku(null);
    }
  };

  const openPortal = async () => {
    setLoadingSku('premium_monthly');
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId }),
        signal: AbortSignal.timeout(20000),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url)
        throw new Error(data.error || 'Portal unavailable');
      window.location.href = data.url;
    } catch (e: any) {
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      toast.error('Billing portal', {
        description: timedOut
          ? 'The request timed out. Please try again.'
          : e?.message,
      });
      setLoadingSku(null);
    }
  };

  return (
    <div className={compact ? 'acct-upgrade' : 'acct-upgrade acct-card'}>
      {!compact && (
        <>
          <h3 className="acct-upgrade-title">
            <Sparkles size={17} aria-hidden="true" /> Promote this listing
          </h3>
          <p className="acct-upgrade-sub">
            Optional paid placement. Free listings stay free forever.
          </p>
        </>
      )}

      {highlightSku && highlightUnavailableReason && (
        <p className="acct-callout acct-callout--warn acct-callout--compact">
          {PAID_PRODUCTS[highlightSku].name} isn&rsquo;t available for this
          listing yet — {highlightUnavailableReason}
        </p>
      )}

      <div className="acct-upgrade-list">
        {visible.map((sku) => {
          const p = PAID_PRODUCTS[sku];
          const isHighlighted = sku === highlightSku;
          const rowClass = `acct-upgrade-row${isHighlighted ? ' is-selected' : ''}${
            sku === 'premium_monthly' ? ' is-premium' : ''
          }${loadingSku && loadingSku !== sku ? ' is-dimmed' : ''}`;
          const nameRow = (
            <span className="acct-upgrade-name">
              {p.name}
              {isHighlighted && (
                <span className="acct-upgrade-selected">Selected</span>
              )}
            </span>
          );

          if (p.weeklyTiers) {
            const maxWeeks = p.maxWeeks || 8;
            const weeks = getWeeks(sku);
            const total = tieredTotal(p, weeks);
            const savingsPct = tieredSavingsPct(p, weeks);
            const current =
              sku === 'category_sponsor_7d'
                ? categorySponsorUntil
                : featuredUntil;
            const stacks = current
              ? new Date(current).getTime() > Date.now()
              : false;
            return (
              <div key={sku} className={rowClass}>
                <div className="acct-upgrade-head">
                  <span className="acct-upgrade-icon" aria-hidden="true">
                    {ICONS[sku]}
                  </span>
                  <span className="acct-upgrade-body">
                    {nameRow}
                    <span className="acct-upgrade-tagline">
                      {p.tagline} · from{' '}
                      {formatUsd(p.weeklyTiers[0].unitAmount)}/wk
                    </span>
                  </span>
                </div>
                <div className="acct-upgrade-controls">
                  <div className="acct-upgrade-weeks">
                    <span className="acct-upgrade-weeks-label">Weeks</span>
                    <div className="acct-stepper">
                      <button
                        type="button"
                        aria-label="Fewer weeks"
                        disabled={loadingSku !== null || weeks <= 1}
                        onClick={() => setWeeks(sku, weeks - 1, maxWeeks)}
                      >
                        <Minus size={13} />
                      </button>
                      <span className="tabular" aria-live="polite">
                        {weeks}
                      </span>
                      <button
                        type="button"
                        aria-label="More weeks"
                        disabled={loadingSku !== null || weeks >= maxWeeks}
                        onClick={() => setWeeks(sku, weeks + 1, maxWeeks)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    {savingsPct > 0 && (
                      <span className="acct-save-pill">Save {savingsPct}%</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={loadingSku !== null}
                    aria-busy={loadingSku === sku}
                    onClick={() => startCheckout(sku, weeks)}
                  >
                    {loadingSku === sku ? (
                      <Loader2
                        size={14}
                        className="acct-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    {loadingSku === sku
                      ? 'Opening checkout…'
                      : `Get ${weeks}wk — ${formatUsd(total)}`}
                  </button>
                </div>
                <p className="acct-upgrade-note">
                  Runs until{' '}
                  <strong>
                    {resultDateFor(sku, weeks).toLocaleDateString(
                      'en-US',
                      DATE_FORMAT,
                    )}
                  </strong>
                  {stacks ? ' (stacks onto your remaining time)' : ''}
                </p>
              </div>
            );
          }

          const priceLabel =
            p.interval === 'month'
              ? `${formatUsd(p.unitAmount)}/mo`
              : formatUsd(p.unitAmount);
          return (
            <div key={sku}>
              <button
                type="button"
                disabled={loadingSku !== null}
                aria-busy={loadingSku === sku}
                onClick={() => startCheckout(sku)}
                className={`${rowClass} acct-upgrade-row--button`}
              >
                <span className="acct-upgrade-icon" aria-hidden="true">
                  {ICONS[sku]}
                </span>
                <span className="acct-upgrade-body">
                  {nameRow}
                  <span className="acct-upgrade-tagline">{p.tagline}</span>
                </span>
                <span className="acct-upgrade-price tabular">
                  {loadingSku === sku ? (
                    <Loader2
                      size={15}
                      className="acct-spin"
                      aria-label="Loading"
                    />
                  ) : (
                    priceLabel
                  )}
                </span>
              </button>
              {sku === 'premium_monthly' && (
                <p className="acct-upgrade-note">
                  Cancel anytime — no long-term lock-in.
                </p>
              )}
            </div>
          );
        })}

        {canManageBilling && (
          <button
            type="button"
            className="btn btn-secondary btn-md"
            disabled={loadingSku !== null}
            onClick={openPortal}
          >
            {loadingSku === 'premium_monthly'
              ? 'Opening…'
              : 'Manage billing & invoices'}
          </button>
        )}
      </div>
    </div>
  );
}
