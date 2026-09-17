'use client';

import { useEffect, useState } from 'react';
import { PremiumUpgrade } from '../../components/PremiumUpgrade';
import {
  type DirectoryServerHit,
  ServerPicker,
} from '../../components/tools/ServerPicker';
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
    initialSku || (initialCategory ? 'featured_7d' : null),
  );
  const [listingName, setListingName] = useState<string | null>(null);
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [featuredUntil, setFeaturedUntil] = useState<string | null>(null);
  const [categorySponsorUntil, setCategorySponsorUntil] = useState<
    string | null
  >(null);
  const [lookupState, setLookupState] = useState<
    'idle' | 'loading' | 'ok' | 'missing'
  >('idle');
  const [myListings, setMyListings] = useState<DirectoryServerHit[] | null>(
    null,
  );

  useEffect(() => {
    const id = serverId.trim();
    if (!id) {
      setListingName(null);
      setListingStatus(null);
      setIsPremium(false);
      setFeaturedUntil(null);
      setCategorySponsorUntil(null);
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
          setFeaturedUntil(null);
          setCategorySponsorUntil(null);
          setLookupState('missing');
          return;
        }
        const data = (await res.json()) as {
          server?: {
            name?: string;
            status?: string;
            isPremium?: boolean;
            featuredUntil?: string | null;
            categorySponsorUntil?: string | null;
          };
        };
        const s = data.server;
        setListingName(s?.name || id);
        setListingStatus(s?.status || 'active');
        setIsPremium(!!s?.isPremium);
        setFeaturedUntil(s?.featuredUntil || null);
        setCategorySponsorUntil(s?.categorySponsorUntil || null);
        setLookupState('ok');
      })
      .catch(() => {
        if (!cancelled) {
          setListingName(null);
          setListingStatus(null);
          setIsPremium(false);
          setFeaturedUntil(null);
          setCategorySponsorUntil(null);
          setLookupState('missing');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serverId]);

  // Signed-in users almost always want to boost one of their own listings — skip the
  // public directory search entirely and offer a one-click pick when we have any.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = sessionRes.ok
          ? ((await sessionRes.json()) as { user?: unknown })
          : null;
        if (cancelled || !session?.user) return;

        const listingsRes = await fetch('/api/dashboard/my-listings');
        const data = listingsRes.ok
          ? ((await listingsRes.json()) as {
              listings?: { id: string; name: string; category: string }[];
            })
          : null;
        if (cancelled) return;
        const listings = data?.listings || [];
        setMyListings(
          listings.map((l) => ({
            id: l.id,
            name: l.name,
            category: l.category,
            description: '',
          })),
        );
      } catch {
        /* not signed in / session check failed — quick-pick just stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickServer = (hit: DirectoryServerHit) => {
    setServerId(hit.id);
    setListingName(hit.name);
  };

  const selectedProduct = selectedSku ? PAID_PRODUCTS[selectedSku] : null;

  return (
    <div
      id="checkout"
      className="surface"
      style={{
        padding: '1.75rem',
        maxWidth: '520px',
        margin: '0 auto',
        scrollMarginTop: '5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
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
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>
          Find your listing to check out
        </h2>
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
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--accent-color)',
                letterSpacing: '0.05em',
              }}
            >
              Buying
            </span>
            <p
              style={{
                margin: '0.15rem 0 0',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {selectedProduct.name}
              {initialCategory ? ` — ${initialCategory}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSku(null)}
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              flexShrink: 0,
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            marginBottom: '1.25rem',
            lineHeight: 1.5,
          }}
        >
          Search for your MCP or paste the listing id from{' '}
          <code>/mcp/your-listing-id</code>, then pick what to buy below.
        </p>
      )}

      {myListings && myListings.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
            }}
          >
            Your listings
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {myListings.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => pickServer(l)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '999px',
                  border:
                    serverId === l.id
                      ? '1px solid var(--accent-color)'
                      : '1px solid var(--border-color)',
                  background:
                    serverId === l.id
                      ? 'rgba(var(--accent-rgb),0.1)'
                      : 'var(--bg-muted)',
                  color: 'var(--text-primary)',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <label
        style={{
          display: 'block',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.35rem',
        }}
      >
        {myListings && myListings.length > 0
          ? 'Or search another listing'
          : 'Find your listing'}
      </label>
      <div style={{ marginBottom: '0.85rem' }}>
        <ServerPicker onSelect={pickServer} placeholder="Search by name…" />
      </div>

      <label
        style={{
          display: 'block',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.35rem',
        }}
      >
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
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem',
          }}
        >
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
        <p
          style={{
            fontSize: '0.8rem',
            color: '#fbbf24',
            marginBottom: '0.75rem',
            lineHeight: 1.45,
          }}
        >
          Couldn&apos;t load that listing from the public catalog (it may still
          be pending). Checkout will still work if the id is correct — Priority
          Review is available for pending submissions.
        </p>
      )}

      {serverId ? (
        <PremiumUpgrade
          serverId={serverId}
          listingStatus={listingStatus || 'active'}
          isPremium={isPremium}
          featuredUntil={featuredUntil}
          categorySponsorUntil={categorySponsorUntil}
          highlightSku={selectedSku}
          compact
          showAll
        />
      ) : (
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          Search or paste a listing id above to see what you can buy for it.
        </p>
      )}
      <p
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          marginTop: '1rem',
          lineHeight: 1.45,
        }}
      >
        After free submit, use the id from your confirmation email or the
        listing URL. Stripe must be configured with live Price IDs for
        production.
      </p>
    </div>
  );
}
