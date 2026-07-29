// Self-destructing service worker.
//
// Earlier versions of this site registered a service worker whose caching logic
// could serve stale HTML pointing at content-hashed assets that 404 after a
// deploy, leaving returning visitors (mobile especially) with an unstyled page.
// The site no longer registers a service worker at all, so this file exists only
// to fully remove any lingering installation from devices that still have one:
// it clears every cache, unregisters itself, and reloads open tabs so they
// re-fetch directly from the network and render with styles. After this runs, no
// service worker controls the origin and the stale-cache bug cannot recur.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Take control of any tabs the previous worker was controlling.
      try {
        await self.clients.claim();
      } catch {}

      // Drop every cache this origin ever stored (including the old poisoned one).
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {}

      // Remove the registration so nothing controls this origin going forward.
      try {
        await self.registration.unregister();
      } catch {}

      // Reload open tabs so they re-fetch from the network and repaint styled
      // instead of showing the previously cached, unstyled response.
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          try {
            client.navigate(client.url);
          } catch {}
        }
      } catch {}
    })()
  );
});

// No fetch handler: while this worker is briefly active before unregistering,
// requests fall through to the network by default. Nothing is served from cache.
