'use client';

import { useState } from 'react';
import { PremiumUpgrade } from '../../components/PremiumUpgrade';

export function PricingClient({ initialServerId = '' }: { initialServerId?: string }) {
  const [serverId, setServerId] = useState(initialServerId);

  return (
    <div className="surface" style={{ padding: '1.75rem', maxWidth: '520px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Checkout for a listing</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
        Enter the listing id (from the URL <code>/mcp/your-listing-id</code>). Priority review is for pending
        submissions; Featured and Premium require an active listing.
      </p>
      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
        Listing ID
      </label>
      <input
        className="form-input"
        value={serverId}
        onChange={(e) => setServerId(e.target.value.trim())}
        placeholder="e.g. awesome-mcp-server"
        style={{ marginBottom: '1.25rem' }}
      />
      {serverId ? (
        <PremiumUpgrade serverId={serverId} listingStatus="active" compact showAll />
      ) : (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          Paste a listing id to enable checkout buttons.
        </p>
      )}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: 1.45 }}>
        For pending submissions, open the claim or detail path after submit, or use Priority from the pending
        listing once you have its id. Stripe must be configured with test/live keys and Price IDs.
      </p>
    </div>
  );
}
