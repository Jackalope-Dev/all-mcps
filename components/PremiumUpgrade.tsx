'use client';

import { useState, type ReactNode } from 'react';
import { Sparkles, Zap, Crown } from 'lucide-react';
import { toast } from './ui/Toast';
import { formatUsd, PAID_PRODUCTS, type PaidSku } from '../lib/pricing';

type Props = {
  serverId: string;
  /** pending listings can buy priority; active can buy featured/premium */
  listingStatus?: string;
  isPremium?: boolean;
  compact?: boolean;
  /** Show every SKU (pricing page); API still enforces listing status. */
  showAll?: boolean;
};

const ICONS: Record<PaidSku, ReactNode> = {
  priority_review: <Zap size={18} />,
  featured_7d: <Sparkles size={18} />,
  premium_monthly: <Crown size={18} />,
};

export function PremiumUpgrade({
  serverId,
  listingStatus = 'active',
  isPremium = false,
  compact = false,
  showAll = false,
}: Props) {
  const [loadingSku, setLoadingSku] = useState<PaidSku | null>(null);

  const visible = (Object.keys(PAID_PRODUCTS) as PaidSku[]).filter((sku) => {
    if (showAll) return !(sku === 'premium_monthly' && isPremium);
    if (sku === 'priority_review') return listingStatus === 'pending';
    if (sku === 'premium_monthly' && isPremium) return false;
    return listingStatus === 'active';
  });

  if (visible.length === 0 && !isPremium) return null;

  const startCheckout = async (sku: PaidSku) => {
    setLoadingSku(sku);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, sku }),
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {visible.map((sku) => {
          const p = PAID_PRODUCTS[sku];
          const priceLabel =
            p.interval === 'month' ? `${formatUsd(p.unitAmount)}/mo` : formatUsd(p.unitAmount);
          return (
            <button
              key={sku}
              type="button"
              disabled={loadingSku !== null}
              onClick={() => startCheckout(sku)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textAlign: 'left',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                border: '1px solid rgba(0,229,255,0.25)',
                background:
                  sku === 'premium_monthly'
                    ? 'linear-gradient(135deg, rgba(0,229,255,0.1), rgba(0,123,255,0.08))'
                    : 'rgba(255,255,255,0.04)',
                color: 'var(--text-primary)',
                cursor: loadingSku ? 'wait' : 'pointer',
                opacity: loadingSku && loadingSku !== sku ? 0.6 : 1,
              }}
            >
              <span style={{ color: 'var(--accent-color)', display: 'flex' }}>{ICONS[sku]}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</span>
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

        {isPremium && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loadingSku !== null}
            onClick={openPortal}
            style={{ fontSize: '0.85rem' }}
          >
            {loadingSku === 'premium_monthly' ? 'Opening…' : 'Manage billing'}
          </button>
        )}
      </div>
    </div>
  );
}
