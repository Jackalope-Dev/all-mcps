'use client';

import { useEffect } from 'react';
import { onAnalyticsReady } from '../lib/analyticsLoader';
import { fetchBrowserSession } from '../lib/clientSession';

/**
 * Attaches signed-in users to PostHog person profiles (person_profiles: identified_only).
 * No-ops when PostHog is opted out or the session is anonymous. PostHog is
 * loaded late (lib/analyticsLoader.ts), so identify waits until its stub
 * exists; the stub queues the call until the library itself arrives.
 */
export function PostHogIdentify() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBrowserSession();
        if (cancelled) return;
        const user = data?.user;
        if (!user?.id && !user?.email) return;
        onAnalyticsReady(() => {
          if (cancelled) return;
          const ph = (window as any).posthog;
          if (!ph || typeof ph.identify !== 'function') return;
          const distinctId = user.id || user.email;
          ph.identify(distinctId, {
            email: user.email || undefined,
            name: user.name || undefined,
          });
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
