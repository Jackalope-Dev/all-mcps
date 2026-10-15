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
    <div id="checkout" className="acct-checkout">
      <div className="acct-checkout-head">
        <h2>Ready to boost a listing?</h2>
        <p>
          Pick your listing and we&rsquo;ll show everything you can buy for it.
          Checkout is handled securely by Stripe.
        </p>
      </div>

      {selectedProduct ? (
        <div className="acct-checkout-selected">
          <div>
            <span className="acct-checkout-selected-label">Buying</span>
            <p>
              {selectedProduct.name}
              {initialCategory ? ` — ${initialCategory}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSelectedSku(null)}
          >
            Change
          </button>
        </div>
      ) : null}

      {myListings && myListings.length > 0 && (
        <div className="acct-checkout-field">
          <span className="form-label">Your listings</span>
          <div className="acct-chip-row">
            {myListings.map((l) => (
              <button
                key={l.id}
                type="button"
                className="chip"
                aria-pressed={serverId === l.id}
                onClick={() => pickServer(l)}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="acct-checkout-field">
        <span className="form-label">
          {myListings && myListings.length > 0
            ? 'Or search another listing'
            : 'Find your listing'}
        </span>
        <ServerPicker onSelect={pickServer} placeholder="Search by name…" />
      </div>

      <div className="acct-checkout-field">
        <label htmlFor="checkout-listing-id" className="form-label">
          Or paste a listing ID
        </label>
        <input
          id="checkout-listing-id"
          className="form-input"
          value={serverId}
          onChange={(e) => setServerId(e.target.value.trim())}
          placeholder="e.g. awesome-mcp-server"
        />
        <p className="acct-field-hint">
          It&rsquo;s the last part of your listing URL —{' '}
          <code>/mcp/your-listing-id</code> — and it&rsquo;s in your
          confirmation email.
        </p>
      </div>

      {serverId && lookupState === 'loading' && (
        <p className="acct-checkout-status">Looking up listing…</p>
      )}
      {serverId && lookupState === 'ok' && listingName && (
        <p className="acct-checkout-found">
          <strong>{listingName}</strong>
          <span>
            {' '}
            · {listingStatus || 'unknown'}
            {isPremium ? ' · Premium' : ''}
          </span>
        </p>
      )}
      {serverId && lookupState === 'missing' && (
        <p className="acct-callout acct-callout--warn acct-callout--compact">
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
        <p className="acct-checkout-empty">
          Choose a listing above to see available upgrades.
        </p>
      )}
    </div>
  );
}
