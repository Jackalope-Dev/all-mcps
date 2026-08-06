'use client';

import { useState, type ReactNode } from 'react';
import { Sparkles, Zap, Crown, Minus, Plus } from 'lucide-react';
import { toast } from './ui/Toast';
import { formatUsd, PAID_PRODUCTS, tieredTotal, tieredSavingsPct, type PaidSku } from '../lib/pricing';
import { trackBeginCheckout } from '../lib/gtag';

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
}: Props) {
  const [loadingSku, setLoadingSku] = useState<PaidSku | null>(null);
  const [weeksBySku, setWeeksBySku] = useState<Partial<Record<PaidSku, number>>>({});

  const getWeeks = (sku: PaidSku) => weeksBySku[sku] ?? 1;
  const setWeeks = (sku: PaidSku, weeks: number, maxWeeks: number) =>
    setWeeksBySku((prev) => ({ ...prev, [sku]: Math.min(maxWeeks, Math.max(1, weeks)) }));

  const visible = (Object.keys(PAID_PRODUCTS) as PaidSku[])
    .filter((sku) => {
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

  if (visible.length === 0 && !canManageBilling && !highlightUnavailableReason) return null;

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
      const data = (await res.json()) as { url?: string; error?: string; hint?: string };
      if (!res.ok || !data.url) {
        throw new Error([data.error, data.hint].filter(Boolean).join(' ') || 'Checkout unavailable');
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
      if (!res.ok || !data.url) throw new Error(data.error || 'Portal unavailable');
      window.location.href = data.url;
    } catch (e: any) {
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      toast.error('Billing portal', {
        description: timedOut ? 'The request timed out. Please try again.' : e?.message,
      });
      setLoadingSku(null);
    }
  };

  return (
    <div className={compact ? '' : 'surface'} style={compact ? undefined : { padding: '1.5rem' }}>
      {!compact && (
        <>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={18} color="var(--accent-color)" /> Promote this listing
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
            Optional paid placement. Free listings stay free forever.
          </p>
        </>
      )}

      {highlightUnavailableReason && (
        <p
          style={{
            fontSize: '0.8rem',
            color: '#d97706',
            background: 'rgba(217,119,6,0.1)',
            border: '1px solid rgba(217,119,6,0.3)',
            borderRadius: '10px',
            padding: '0.65rem 0.85rem',
            marginBottom: '0.85rem',
            lineHeight: 1.5,
          }}
        >
          {PAID_PRODUCTS[highlightSku!].name} isn&rsquo;t available for this listing yet — {highlightUnavailableReason}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {visible.map((sku) => {
          const p = PAID_PRODUCTS[sku];
          const isHighlighted = sku === highlightSku;
          const rowStyle = {
            borderRadius: '12px',
            border: isHighlighted
              ? '1px solid var(--accent-color)'
              : '1px solid rgba(var(--accent-rgb),0.25)',
            boxShadow: isHighlighted ? '0 0 0 3px rgba(var(--accent-rgb),0.15)' : 'none',
            background:
              sku === 'premium_monthly' || isHighlighted
                ? 'linear-gradient(135deg, rgba(var(--accent-rgb),0.1), rgba(var(--accent-secondary-rgb),0.08))'
                : 'var(--bg-muted)',
            color: 'var(--text-primary)',
          };
          const nameRow = (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem' }}>
              {p.name}
              {isHighlighted && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--accent-color)',
                    background: 'rgba(var(--accent-rgb),0.15)',
                    borderRadius: '4px',
                    padding: '0.1rem 0.4rem',
                  }}
                >
                  Selected
                </span>
              )}
            </span>
          );

          if (p.weeklyTiers) {
            const maxWeeks = p.maxWeeks || 8;
            const weeks = getWeeks(sku);
            const total = tieredTotal(p, weeks);
            const savingsPct = tieredSavingsPct(p, weeks);
            return (
              <div key={sku} style={{ ...rowStyle, padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--accent-color)', display: 'flex', marginTop: '0.1rem' }}>{ICONS[sku]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {nameRow}
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {p.tagline} · from {formatUsd(p.weeklyTiers[0].unitAmount)}/wk
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Weeks</span>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <button
                        type="button"
                        aria-label="Fewer weeks"
                        disabled={loadingSku !== null || weeks <= 1}
                        onClick={() => setWeeks(sku, weeks - 1, maxWeeks)}
                        style={{ padding: '0.35rem 0.5rem', background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-primary)', cursor: weeks <= 1 ? 'not-allowed' : 'pointer', display: 'flex' }}
                      >
                        <Minus size={13} />
                      </button>
                      <span style={{ minWidth: '1.75rem', textAlign: 'center', fontWeight: 700, fontSize: '0.875rem' }}>{weeks}</span>
                      <button
                        type="button"
                        aria-label="More weeks"
                        disabled={loadingSku !== null || weeks >= maxWeeks}
                        onClick={() => setWeeks(sku, weeks + 1, maxWeeks)}
                        style={{ padding: '0.35rem 0.5rem', background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-primary)', cursor: weeks >= maxWeeks ? 'not-allowed' : 'pointer', display: 'flex' }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    {savingsPct > 0 && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', background: 'rgba(16,185,129,0.12)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                        Save {savingsPct}%
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={loadingSku !== null}
                    onClick={() => startCheckout(sku, weeks)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--accent-color)',
                      color: 'var(--bg-color)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: loadingSku ? 'wait' : 'pointer',
                      opacity: loadingSku && loadingSku !== sku ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {loadingSku === sku ? '…' : `Get ${weeks}wk — ${formatUsd(total)}`}
                  </button>
                </div>
              </div>
            );
          }

          const priceLabel =
            p.interval === 'month' ? `${formatUsd(p.unitAmount)}/mo` : formatUsd(p.unitAmount);
          return (
            <button
              key={sku}
              type="button"
              disabled={loadingSku !== null}
              onClick={() => startCheckout(sku)}
              style={{
                ...rowStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textAlign: 'left',
                padding: '0.85rem 1rem',
                cursor: loadingSku ? 'wait' : 'pointer',
                opacity: loadingSku && loadingSku !== sku ? 0.6 : 1,
              }}
            >
              <span style={{ color: 'var(--accent-color)', display: 'flex' }}>{ICONS[sku]}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {nameRow}
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {p.tagline}
                </span>
              </span>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                {loadingSku === sku ? '…' : priceLabel}
              </span>
            </button>
          );
        })}

        {canManageBilling && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loadingSku !== null}
            onClick={openPortal}
            style={{ fontSize: '0.85rem' }}
          >
            {loadingSku === 'premium_monthly' ? 'Opening…' : 'Manage billing & invoices'}
          </button>
        )}
      </div>
    </div>
  );
}
