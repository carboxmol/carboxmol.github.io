// Carbox & CarboxMol PWA Universal Service Worker
// Version: v0.4.5 · High-Resilience Stale-While-Revalidate & Auto-Sync Engine
'use strict';

const PWA_VERSION = 'v0.4.5';
const CACHE_NAME = 'carboxmol-pwa-' + PWA_VERSION;
const RUNTIME_CACHE = 'carboxmol-runtime-' + PWA_VERSION;

// Comprehensive pre-cached offline inventory
const CORE_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './studio.html',
  './downloads.html',
  './docs.html',
  './styles.css',
  './studio.css',
  './app.js',
  './studio.js',
  './pwa-sync.js',
  './data.js',
  './structures.js',
  './manifest.json',
  './manifest-studio.json',
  './manifest-carboxmol.json',
  './favicon.ico',
  './favicon.png',
  './libs/3Dmol-min.js',
  './libs/chart.min.js',
  './assets/carboxmol_logo.png',
  './assets/carboxmol_logo.jpg',
  './assets/carbox_logo.png',
  './assets/carbox_logo.svg',
  './assets/carboxmol_pwa_icon_192.png',
  './assets/carboxmol_pwa_icon_512.png',
  './assets/carbox_pwa_icon_192.png',
  './assets/carbox_pwa_icon_512.png',
  './assets/pwa-icon-192.png',
  './assets/pwa-icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/carboxmol_apple_touch_icon.png',
  './assets/carbox_apple_touch_icon.png',
  './assets/carboxmol_favicon32.png',
  './assets/carboxmol_favicon64.png',
  './assets/carbox_favicon32.png',
  './assets/carbox_favicon64.png',
  './assets/os_apple.svg',
  './assets/os_linux.svg',
  './assets/os_windows.svg'
];

// ─── Install Lifecycle: Rapid Pre-cache & Immediate Activation ───────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use map with Promise.allSettled so a single missing asset does not abort install
      await Promise.allSettled(
        CORE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[Carbox PWA SW] Pre-cache item note:', asset, err);
          })
        )
      );
      console.log(`[Carbox PWA SW] Pre-cached core assets for ${PWA_VERSION}.`);
    })
  );
});

// ─── Activate Lifecycle: Cache Migration & Client Claims ─────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
            console.log('[Carbox PWA SW] Evicting legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(async () => {
      await self.clients.claim();
      // Broadcast activation to all connected clients/windows
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({
          type: 'PWA_ACTIVATED',
          version: PWA_VERSION
        });
      }
      console.log(`[Carbox PWA SW] Activated and claimed clients for ${PWA_VERSION}.`);
    })
  );
});

// ─── Fetch Lifecycle: Smart Network-First / Stale-While-Revalidate ─────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Live dynamic backend endpoints (do not cache mutable API by default)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Navigation Requests (HTML Pages): Network-First with fast fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline or slow network: serve matching cached document
          const cached = await caches.match(event.request);
          if (cached) return cached;

          // Fallback based on URL path
          if (url.pathname.includes('studio')) {
            return (await caches.match('./studio.html')) || (await caches.match('/studio.html'));
          }
          if (url.pathname.includes('downloads')) {
            return (await caches.match('./downloads.html')) || (await caches.match('/downloads.html'));
          }
          if (url.pathname.includes('docs')) {
            return (await caches.match('./docs.html')) || (await caches.match('/docs.html'));
          }
          return (await caches.match('./dashboard.html')) ||
                 (await caches.match('./index.html')) ||
                 (await caches.match('./'));
        })
    );
    return;
  }

  // 3. Static Assets (CSS, JS, Fonts, Images, Icons, Libs): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Background network fetch to refresh local cache with the newest version
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed (offline); cachedResponse will satisfy the request if available
          return null;
        });

      // Return cached version instantly for 0ms startup, while background fetch updates the cache
      return cachedResponse || fetchPromise.then((networkResponse) => {
        if (networkResponse) return networkResponse;
        return new Response('Asset not available offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});

// ─── Messaging Bridge ────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CHECK_VERSION') {
    if (event.source) {
      event.source.postMessage({
        type: 'VERSION_INFO',
        version: PWA_VERSION
      });
    }
  }

  if (event.data.type === 'TRIGGER_SYNC') {
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          try {
            const res = await fetch(asset, { cache: 'reload' });
            if (res && res.status === 200) {
              await cache.put(asset, res);
            }
          } catch (e) {}
        })
      );
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({
          type: 'PWA_SYNC_COMPLETE',
          version: PWA_VERSION
        });
      }
    });
  }
});
