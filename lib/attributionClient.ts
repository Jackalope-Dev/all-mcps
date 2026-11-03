import { captureTouch, isDirect } from './attribution';

/**
 * The page this tab was opened on and its referrer, captured once per page
 * load before any client-side navigation, so a visitor who only accepts the
 * cookie banner on their second page is still attributed to where they
 * arrived from.
 */
let landing: { href: string; referrer: string } | undefined;

const SENT_KEY = 'allmcps_src_sent';

export function snapshotLandingTouch() {
  if (landing || typeof window === 'undefined') return;
  landing = { href: window.location.href, referrer: document.referrer };
}

/**
 * Asks the server to store the attribution cookie (app/api/attribution). Only
 * call once analytics consent is granted. Sent once per browser session, plus
 * whenever a later visit actually came from somewhere (it may upgrade a
 * stored direct visit).
 */
export function persistLandingTouch() {
  snapshotLandingTouch();
  if (!landing) return;
  const touch = captureTouch({ ...landing, now: Date.now() });
  if (!touch) return;
  let sent = false;
  try {
    sent = sessionStorage.getItem(SENT_KEY) === '1';
  } catch {
    // Storage blocked: just send.
  }
  if (sent && isDirect(touch)) return;
  fetch('/api/attribution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(landing),
    keepalive: true,
  })
    .then(() => {
      try {
        sessionStorage.setItem(SENT_KEY, '1');
      } catch {
        // ignore
      }
    })
    .catch(() => {
      // Attribution is best effort.
    });
}

/** Removes the attribution cookie after the visitor declines analytics. */
export function clearLandingTouch() {
  try {
    sessionStorage.removeItem(SENT_KEY);
  } catch {
    // ignore
  }
  fetch('/api/attribution', { method: 'DELETE', keepalive: true }).catch(
    () => {},
  );
}
