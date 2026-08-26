/**
 * Shared browser session fetch so header CTA + PostHog identify don't each
 * hit `/api/auth/session` on every page load.
 */
export type BrowserSession = {
  user?: { id?: string; email?: string | null; name?: string | null };
} | null;

let inflight: Promise<BrowserSession> | null = null;

export function fetchBrowserSession(): Promise<BrowserSession> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!inflight) {
    inflight = fetch('/api/auth/session')
      .then((res) => (res.ok ? (res.json() as Promise<BrowserSession>) : null))
      .catch(() => null);
  }
  return inflight;
}
