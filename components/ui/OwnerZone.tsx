'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Sparkles } from 'lucide-react';
import { PremiumUpgrade } from '../PremiumUpgrade';

type Props = {
  serverId: string;
  isOfficial: boolean;
  websiteUrl?: string | null;
  isPremium?: boolean;
  websiteBacklinkOk?: boolean;
  status: string;
  featuredUntil?: string | Date | null;
  categorySponsorUntil?: string | Date | null;
};

/**
 * Owner-only sidebar controls (website/verification management + premium
 * upsell) for the /mcp/[id] detail page. Ownership is fetched client-side
 * (instead of the page checking the session server-side) so the page itself
 * stays cacheable — see app/api/mcp/[id]/is-owner/route.ts. Renders nothing
 * until the check resolves and nothing at all for non-owners.
 */
export function OwnerZone({
  serverId,
  isOfficial,
  websiteUrl,
  isPremium,
  websiteBacklinkOk,
  status,
  featuredUntil,
  categorySponsorUntil,
}: Props) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mcp/${serverId}/is-owner`);
        const data = res.ok ? ((await res.json()) as { isOwner?: boolean }) : null;
        if (!cancelled) setIsOwner(Boolean(data?.isOwner));
      } catch {
        // Network error — leave the logged-out/non-owner default in place.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const dofollow = !!isPremium || !!websiteBacklinkOk;

  return (
    <>
      {isOfficial && isOwner && (
        <div className="surface" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Globe size={18} color="var(--accent-color)" /> Listing owner
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.55 }}>
            {websiteUrl
              ? websiteBacklinkOk
                ? 'Website is attached and Verified — the AllMCPs badge is live and detected automatically.'
                : 'Website is attached. Place the AllMCPs badge on it to get Verified automatically — no submission needed, we detect it on our next check.'
              : 'Add your product site, then place the AllMCPs badge to get Verified automatically.'}
          </p>

          {websiteUrl && (
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                background: dofollow ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${dofollow ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`,
              }}
            >
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: dofollow ? 'var(--verified-green)' : 'var(--text-secondary)', marginBottom: dofollow ? 0 : '0.5rem' }}>
                {dofollow
                  ? `Website link is dofollow${isPremium ? ' — Premium' : ' — reciprocal badge verified'}`
                  : 'Website link is nofollow'}
              </p>
              {!dofollow && (
                <>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    Add the AllMCPs badge to your site and verify it to earn a free dofollow backlink — rechecked periodically to stay live. Premium listings get dofollow instantly, no badge required.
                  </p>
                  <Link
                    href={`/mcp/${serverId}/claim`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.85rem',
                      background: 'rgba(0,229,255,0.1)',
                      border: '1px solid rgba(0,229,255,0.3)',
                      color: '#00E5FF',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                    }}
                  >
                    <Sparkles size={14} /> Get a free dofollow link
                  </Link>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <Link
              href={`/mcp/${serverId}/claim`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Manage website &amp; verification
            </Link>
            <Link
              href={`/dashboard?edit=${serverId}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.75rem 1rem',
                background: 'var(--brand-gradient)',
                color: 'var(--bg-color)',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              Manage listing
            </Link>
          </div>
        </div>
      )}

      {isOwner && status === 'active' && (
        <PremiumUpgrade
          serverId={serverId}
          listingStatus={status}
          isPremium={!!isPremium}
          featuredUntil={featuredUntil}
          categorySponsorUntil={categorySponsorUntil}
        />
      )}
    </>
  );
}
