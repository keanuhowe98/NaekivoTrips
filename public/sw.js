/* Cache only this app's public assets. Navigation and API requests always go
 * through the network so a hosting sign-in boundary cannot be cached around.
 * Native apps ship their web bundle locally and do not register this worker. */
const CACHE = 'naekivo-static-v1';
const scopeUrl = new URL(self.registration.scope);
const staticFiles = new Set([
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'manifest.webmanifest',
]);

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('naekivo-static-') && key !== CACHE)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode === 'navigate' ||
      url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname) || url.search) return;

  const relativePath = url.pathname.slice(scopeUrl.pathname.length);
  const isBuildAsset = /^assets\/[\w.-]+\.(?:js|css|woff2?|png|jpe?g|webp|svg|avif)$/.test(relativePath);
  if (!isBuildAsset && !staticFiles.has(relativePath)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    const contentType = response.headers.get('content-type') || '';
    const cacheControl = response.headers.get('cache-control') || '';
    // Refuse redirected sign-in pages and private/no-store responses.
    if (response.ok && !response.redirected && !contentType.includes('text/html') &&
        !/\b(?:no-store|private)\b/i.test(cacheControl)) {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
