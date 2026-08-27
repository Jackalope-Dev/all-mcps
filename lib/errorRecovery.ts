/**
 * Auto-recovery for transient client errors.
 *
 * After a deploy, a browser (or CDN edge, or restored bfcache page) can hold
 * HTML that references hashed JS/CSS chunks which no longer exist in the new
 * build. Loading one of those chunks throws, React unwinds to the nearest error
 * boundary, and the user sees "Something went wrong" — which vanishes on a manual
 * refresh because the fresh HTML references the current chunks. This module turns
 * that manual refresh into an automatic one.
 *
 * Safety: a single reload is attempted per URL, gated by a timestamp in
 * sessionStorage. If the same URL errors again within RELOAD_WINDOW_MS, we stop
 * and let the real error UI render — so a genuinely broken page can never loop.
 * If sessionStorage is unavailable (e.g. iOS private mode), we do NOT reload at
 * all, because we cannot guarantee the loop guard.
 */

const RELOAD_KEY = 'amcp:lastAutoReload';
const RELOAD_WINDOW_MS = 20_000;

type ReloadMark = { path: string; at: number };

/** A sessionStorage handle, or null if reading/writing it isn't safe. */
function safeSessionStorage(): Storage | null {
  try {
    const s = window.sessionStorage;
    const probe = '__amcp_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** Heuristic: does this error look like a chunk/asset/network load failure? */
export function isLikelyTransientLoadError(error?: {
  name?: string;
  message?: string;
}): boolean {
  const haystack = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return (
    haystack.includes('chunk') ||
    haystack.includes('dynamically imported') ||
    haystack.includes('importing a module') ||
    haystack.includes('module script failed') ||
    haystack.includes('failed to fetch') ||
    haystack.includes('loading css chunk') ||
    haystack.includes('networkerror')
  );
}

/**
 * Attempt a one-time automatic reload of the current URL. Returns true if a
 * reload was triggered (the caller should render nothing / a spinner, since the
 * page is about to navigate away), or false if we deliberately did not reload
 * (no reliable guard, or we already tried this URL recently).
 */
export function attemptAutoReload(): boolean {
  if (typeof window === 'undefined') return false;

  const store = safeSessionStorage();
  if (!store) return false; // Can't guard against a loop — do not reload.

  const path = window.location.pathname + window.location.search;
  const now = Date.now();

  let last: ReloadMark | null = null;
  try {
    const raw = store.getItem(RELOAD_KEY);
    last = raw ? (JSON.parse(raw) as ReloadMark) : null;
  } catch {
    last = null;
  }

  // Already reloaded this exact URL moments ago → the reload didn't help; stop.
  if (last && last.path === path && now - last.at < RELOAD_WINDOW_MS) {
    return false;
  }

  try {
    store.setItem(RELOAD_KEY, JSON.stringify({ path, at: now }));
  } catch {
    return false;
  }

  window.location.reload();
  return true;
}
