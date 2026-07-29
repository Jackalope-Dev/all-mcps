// Bump this whenever the caching strategy changes — the activate handler purges
// every cache that doesn't match, so a version bump clears poisoned entries left
// by older service workers on the next visit.
const CACHE_NAME = 'allmcps-cache-v3';

// Only precache assets whose URL is stable across deploys. Never precache '/' or
// other HTML here: HTML references content-hashed asset URLs, so a stale cached
// document can point at CSS/JS filenames that no longer exist on the server.
const PRECACHE = ['/manifest.webmanifest', '/icon.jpg', '/logo-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // let the browser handle cross-origin requests

  // Content-hashed build output (/_next/static/...) is immutable: the filename
  // changes whenever the content changes. Serve it cache-first so a returning
  // visitor whose cached HTML references an older build still gets a matching,
  // consistent asset from the cache instead of a 404 for a hash that's been
  // deployed away. This is what prevents the "unstyled after deploy" bug.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // HTML navigations: network-first so online visitors always get fresh markup
  // (and therefore current asset hashes), falling back to the cached copy of the
  // SAME page only when the network is unavailable. Critically, we never fall
  // back to a different page — returning '/' HTML for another request is what
  // previously served HTML in place of CSS/JS and broke styling.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (images, fonts, API GETs): network-first with a cache
  // fallback for the exact same request only — never a cross-request fallback.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
