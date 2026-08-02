'use client';

import { useEffect } from 'react';

/**
 * Attaches signed-in users to PostHog person profiles (person_profiles: identified_only).
 * No-ops when PostHog is opted out or the session is anonymous.
 */
export function PostHogIdentify() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          user?: { id?: string; email?: string | null; name?: string | null };
        };
        const user = data?.user;
        if (!user?.id && !user?.email) return;
        const ph = (window as any).posthog;
        if (!ph || typeof ph.identify !== 'function') return;
        const distinctId = user.id || user.email;
        ph.identify(distinctId, {
          email: user.email || undefined,
          name: user.name || undefined,
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
