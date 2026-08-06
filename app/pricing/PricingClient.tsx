'use client';

import { useEffect, useState } from 'react';
import { PremiumUpgrade } from '../../components/PremiumUpgrade';
import { ServerPicker, type DirectoryServerHit } from '../../components/tools/ServerPicker';
import { PAID_PRODUCTS, type PaidSku } from '../../lib/pricing';

export function PricingClient({
  initialServerId = '',
  initialCategory = '',
  initialSku = null,
}: {
  initialServerId?: string;
  initialCategory?: string;
  initialSku?: PaidSku | null;
}) {
  const [serverId, setServerId] = useState(initialServerId);
  const [selectedSku, setSelectedSku] = useState<PaidSku | null>(
    initialSku || (initialCategory ? 'category_sponsor_7d' : null)
  );
  const [listingName, setListingName] = useState<string | null>(null);
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'ok' | 'missing'>('idle');

  useEffect(() => {
    const id = serverId.trim();
    if (!id) {
      setListingName(null);
      setListingStatus(null);
      setIsPremium(false);
      setLookupState('idle');
      return;
    }

    let cancelled = false;
    setLookupState('loading');

    // Prefer public API; pending listings may 404 if only active rows are public —
    // checkout API still validates status server-side for the real SKU.
    fetch(`/api/v1/servers/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setListingName(null);
          setListingStatus(null);
          setIsPremium(false);
          setLookupState('missing');
          return;
        }
        const data = (await res.json()) as {
          server?: { name?: string; status?: string; isPremium?: boolean };
        };
        const s = data.server;
        setListingName(s?.name || id);
        setListingStatus(s?.status || 'active');
        setIsPremium(!!s?.isPremium);
        setLookupState('ok');
      })
      .catch(() => {
        if (!cancelled) {
          setListingName(null);
          setListingStatus(null);
          setIsPremium(false);
          setLookupState('missing');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const pickServer = (hit: DirectoryServerHit) => {
    setServerId(hit.id);
    setListingName(hit.name);
  };

  const selectedProduct = selectedSku ? PAID_PRODUCTS[selectedSku] : null;

  return (
    <div id="checkout" className="surface" style={{ padding: '1.75rem', maxWidth: '520px', margin: '0 auto', scrollMarginTop: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'rgba(var(--accent-rgb), 0.12)',
            border: '1px solid rgba(var(--accent-rgb), 0.3)',
            color: 'var(--accent-color)',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          2
        </span>
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Find your listing to check out</h2>
      </div>

      {selectedProduct ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: 'rgba(var(--accent-rgb), 0.08)',
            border: '1px solid rgba(var(--accent-rgb), 0.3)',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-color)', letterSpacing: '0.05em' }}>
              Buying
            </span>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {selectedProduct.name}
              {initialCategory ? ` — ${initialCategory}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSku(null)}
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
          >
            Change
          </button>
        </div>
      ) : (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Search for your MCP or paste the listing id from <code>/mcp/your-listing-id</code>, then pick what to buy below.
        </p>
      )}

      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
        Find your listing
      </label>
      <div style={{ marginBottom: '0.85rem' }}>
        <ServerPicker onSelect={pickServer} placeholder="Search by name…" />
      </div>

      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
        Listing ID
      </label>
      <input
        className="form-input"
        value={serverId}
        onChange={(e) => setServerId(e.target.value.trim())}
        placeholder="e.g. awesome-mcp-server"
        style={{ marginBottom: '0.75rem' }}
      />

      {serverId && lookupState === 'loading' && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Looking up listing…
        </p>
      )}
      {serverId && lookupState === 'ok' && listingName && (
        <p
          style={{
            fontSize: '0.85rem',
            marginBottom: '0.75rem',
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            background: 'rgba(var(--accent-rgb),0.06)',
            border: '1px solid rgba(var(--accent-rgb),0.22)',
            color: 'var(--text-primary)',
          }}
        >
          <strong>{listingName}</strong>
          <span style={{ color: 'var(--text-secondary)' }}>
            {' '}
            · status: {listingStatus || 'unknown'}
            {isPremium ? ' · Premium' : ''}
          </span>
        </p>
      )}
      {serverId && lookupState === 'missing' && (
        <p style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.75rem', lineHeight: 1.45 }}>
          Couldn&apos;t load that listing from the public catalog (it may still be pending). Checkout will
          still work if the id is correct — Priority Review is available for pending submissions.
        </p>
      )}

      {serverId ? (
        <PremiumUpgrade
          serverId={serverId}
          listingStatus={listingStatus || 'active'}
          isPremium={isPremium}
          highlightSku={selectedSku}
          compact
          showAll
        />
      ) : (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          Search or paste a listing id above to see what you can buy for it.
        </p>
      )}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: 1.45 }}>
        After free submit, use the id from your confirmation email or the listing URL. Stripe must be
        configured with live Price IDs for production.
      </p>
    </div>
  );
}
