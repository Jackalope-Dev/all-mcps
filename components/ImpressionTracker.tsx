'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ImpressionSurface } from '@/lib/impressionLog';

type PendingImpression = { serverId: string; surface: ImpressionSurface };

let sessionHash: string | null = null;
const seen = new Set<string>();
let pending: PendingImpression[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getSessionHash(): string {
  if (sessionHash) return sessionHash;
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('allmcps-session');
    if (stored) {
      sessionHash = stored;
    } else {
      sessionHash = crypto.randomUUID();
      sessionStorage.setItem('allmcps-session', sessionHash);
    }
  }
  return sessionHash || 'anon';
}

function flush() {
  if (pending.length === 0) return;
  const batch = pending.splice(0, 50);
  const hash = getSessionHash();

  // Use sendBeacon for reliability on page unload, fetch otherwise
  const body = JSON.stringify({ impressions: batch, sessionHash: hash });
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/impressions', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/impressions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 3000);
}

function enqueue(serverId: string, surface: ImpressionSurface) {
  const key = `${serverId}:${surface}`;
  if (seen.has(key)) return;
  seen.add(key);
  pending.push({ serverId, surface });
  scheduleFlush();
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

/**
 * Hook that returns a function to manually track impressions.
 */
export function useImpressionTracker() {
  const trackImpression = useCallback(
    (serverId: string, surface: ImpressionSurface) => {
      enqueue(serverId, surface);
    },
    []
  );
  return { trackImpression };
}

/**
 * Component that auto-tracks an impression when it becomes visible.
 * Wrap it around a listing card and it fires once per session.
 */
export function ImpressionBeacon({
  serverId,
  surface,
  children,
}: {
  serverId: string;
  surface: ImpressionSurface;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          enqueue(serverId, surface);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [serverId, surface]);

  return <div ref={ref}>{children}</div>;
}
