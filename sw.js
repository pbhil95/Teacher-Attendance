/*
 * JNV Tarikhet Attendance — Service Worker
 * Strategy: Cache-first for static assets, Network-first for API/auth
 */

const CACHE_NAME = 'jnv-att-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './style.css',
  './dashboard.css',
  './app.js',
  './auth.js',
  './dashboard.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Syne:wght@700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// ── INSTALL: pre-cache all static assets ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
        .catch(err => {
          console.warn('[SW] Pre-cache failed for some assets:', err);
        });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: remove old caches ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: smart caching strategy ────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls (database/auth must always be fresh)
  if (url.hostname.includes('supabase.co') && url.pathname.startsWith('/rest')) {
    return; // let browser handle normally
  }
  if (url.hostname.includes('supabase.co') && url.pathname.startsWith('/auth')) {
    return; // let browser handle normally
  }

  // For CDN and font resources — cache first, network fallback
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('jsdelivr.net')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // For our own static files — cache first, network fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        }).catch(() => cached); // offline: return cached

        // Return cached immediately if available, update in background
        return cached || networkFetch;
      })
    );
  }
});
