// Self-destroying recovery service worker.
//
// This site ships NO service worker. An earlier version of the site registered
// an aggressive, cache-first worker at this same path (/sw.js). Browsers that
// still hold that old registration re-fetch /sw.js on their normal service
// worker update check (on navigation, and at least every 24h) and byte-compare
// it against the installed script. Because this file differs, the browser
// installs THIS worker in the old one's place — and all it does is tear the
// whole thing down: purge every Cache Storage entry the old worker populated,
// unregister itself, then reload open tabs so they fetch the current app fresh
// from the network instead of from a stale, chunk-referencing app shell.
//
// The `_headers` file serves this script as `Cache-Control: no-cache` so the
// update check always revalidates against the network and this recovery worker
// can't be pinned out by an HTTP-cached copy of the old script.
//
// A companion page-side kill-switch in app/layout.tsx unregisters workers and
// clears caches from the document context too, covering devices that receive
// fresh HTML before their SW update check fires. The two are redundant on
// purpose: between them, every affected device recovers on its next visit.

self.addEventListener('install', () => {
  // Take over immediately instead of waiting for the old worker's tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Control any open clients so client.navigate() below is allowed to reload
      // them even though they were loaded under the old worker.
      try {
        await self.clients.claim();
      } catch (e) {
        /* claim can fail if there are no clients yet; harmless. */
      }

      // Purge every cache the old worker created.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (e) {
        /* Cache Storage may be unavailable; continue to unregister regardless. */
      }

      // Remove this registration entirely so no worker controls the origin again.
      try {
        await self.registration.unregister();
      } catch (e) {
        /* Already gone; nothing to do. */
      }
    })()
  );
});
