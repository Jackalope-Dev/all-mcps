'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackPurchase } from '../lib/gtag';
import { PaidSku } from '../lib/pricing';

export function PurchaseTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;

    const paidParam = searchParams.get('paid');
    const serverId = searchParams.get('id') || searchParams.get('serverId') || 'unknown';

    if (paidParam && (paidParam === 'priority_review' || paidParam === 'priority' || paidParam === 'featured_7d' || paidParam === 'premium_monthly')) {
      const normalizedSku: PaidSku = paidParam === 'priority' ? 'priority_review' : (paidParam as PaidSku);
      
      const storageKey = `ga_purchase_tracked_${normalizedSku}_${serverId}`;
      const alreadyTracked = typeof window !== 'undefined' && sessionStorage.getItem(storageKey);

      if (!alreadyTracked) {
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        trackPurchase({
          transactionId,
          sku: normalizedSku,
          serverId,
        });

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, 'true');
        }
      }
    }
  }, [searchParams]);

  return null;
}
