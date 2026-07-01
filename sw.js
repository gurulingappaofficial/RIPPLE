/* -------------------------------------------------
   Service Worker for RIPPLE PWA
   - Cache‑first for static assets (HTML, CSS, JS, icons, manifest)
   - Network‑first for the Google Apps Script API (SCRIPT_URL)
   - Updates cache on newer versions
   ------------------------------------------------- */

const CACHE_NAME = 'ripple-static-v1';
const API_URL = 'https://script.google.com'; // base for the Apps Script endpoint

const STATIC_ASSETS = [
  '/',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'icons/icon-72x72.png',
  'icons/icon-96x96.png',
  'icons/icon-128x128.png',
  'icons/icon-144x144.png',
  'icons/icon-152x152.png',
  'icons/icon-192x192.png',
  'icons/icon-384x384.png',
  'icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Network‑first for API calls (Google Apps Script)
  if (url.origin.startsWith(API_URL)) {
    event.respondWith(
      fetch(request)
        .then(networkRes => {
          caches.open(CACHE_NAME).then(cache => cache.put(request, networkRes.clone()));
          return networkRes;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache‑first for everything else (static assets)
  event.respondWith(
    caches.match(request).then(cachedRes =>
      cachedRes || fetch(request).then(networkRes => {
        caches.open(CACHE_NAME).then(cache => cache.put(request, networkRes.clone()));
        return networkRes;
      })
    )
  );
});
