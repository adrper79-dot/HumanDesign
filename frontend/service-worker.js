/**
 * Prime Self - Service Worker
 * Provides offline support and performance optimization
 *
 * BL-OPT-001: Updated with cache versioning and complete asset list
 * 2026-03-09: v10 - Tier 0 z-index normalization fixes
 * 2026-03-09: v11 - UI-008 transit row mobile grid stacking fix
 * 2026-03-09: v12 - Phase 6 dead CSS cleanup (removed IP-risky type classes)
 * 2026-03-09: v13 - Sprint 19: Prime Self data integration, Priming/Forge UI, mobile CTA, error consolidation
 */

const CACHE_VERSION = 'v13';
const CACHE_NAME = `prime-self-${CACHE_VERSION}`;
const MAX_API_CACHE_ENTRIES = 50;
const MAX_STATIC_CACHE_ENTRIES = 80;
const API_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Assets to cache on install (complete list)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/design-tokens.css',
  '/css/design-tokens-premium.css',
  '/css/prime-self.css',
  '/css/prime-self-premium.css',
  '/css/artwork.css',
  '/css/icons.css',
  '/css/app.css',
  '/css/components/buttons.css',
  '/css/components/cards.css',
  '/css/components/forms.css',
  '/css/components/layout.css',
  '/css/components/tabs.css',
  '/css/components/modals.css',
  '/css/components/alerts.css',
  '/css/components/mobile.css',
  '/js/lazy.js',
  '/js/i18n.js',
  '/js/offline-transits.js',
  '/js/asset-randomizer.js',
  '/js/explanations.js',
  '/js/hd-data.js',
  '/js/bodygraph.js',
  '/js/share-card.js',
  '/locales/en.json',
  '/manifest.json',
  // Brand variant v1 assets
  '/icons/icon-192.png',
  '/icons/favicon-32.png',
  '/logo-poster.jpg',
  '/logo-animation.mp4',
  '/logo-animation.webm',
  // Brand variant v2 assets
  '/icons/icon-192-v2.png',
  '/icons/favicon-32-v2.png',
  '/logo-poster-v2.jpg',
  '/logo-animation-v2.mp4',
  '/logo-animation-v2.webm',
  // Background video
  '/bg-video-poster.jpg'
  // NOTE: bg-video.mp4 and bg-video.webm are NOT pre-cached (too large).
  // They are cached on first play via the runtime cache strategy below.
];

/**
 * Evict oldest entries from a cache when it exceeds maxEntries.
 * LRU-style: deletes in insertion order (oldest first).
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    const deleteCount = keys.length - maxEntries;
    await Promise.all(keys.slice(0, deleteCount).map(k => cache.delete(k)));
  }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except for fonts/icons)
  if (url.origin !== self.location.origin) {
    return;
  }

  // API requests: Network first, cache fallback (with eviction)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses, then trim
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              trimCache(CACHE_NAME, MAX_STATIC_CACHE_ENTRIES + MAX_API_CACHE_ENTRIES);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached version if available and not too old
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              // BL-FIX: Enforce API_CACHE_MAX_AGE_MS to avoid serving arbitrarily stale data
              const dateHeader = cachedResponse.headers.get('date');
              if (dateHeader) {
                const age = Date.now() - new Date(dateHeader).getTime();
                if (age > API_CACHE_MAX_AGE_MS) {
                  // Cache entry too old — treat as unavailable
                  return new Response(
                    JSON.stringify({
                      error: 'Offline',
                      message: 'You are currently offline and cached data has expired.'
                    }),
                    {
                      status: 503,
                      statusText: 'Service Unavailable',
                      headers: { 'Content-Type': 'application/json' }
                    }
                  );
                }
              }
              return cachedResponse;
            }
            // Return offline fallback for API errors
            return new Response(
              JSON.stringify({
                error: 'Offline',
                message: 'You are currently offline. Please check your connection.'
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Static assets: Cache first, network fallback
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }

        // Fetch from network and cache
        return fetch(request).then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              trimCache(CACHE_NAME, MAX_STATIC_CACHE_ENTRIES + MAX_API_CACHE_ENTRIES);
            });
          }
          return response;
        });
      })
      .catch((error) => {
        console.error('[Service Worker] Fetch failed:', error);
        
        // Return offline fallback for HTML pages
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
        
        throw error;
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');
  
  let data = { title: 'Prime Self', body: 'New notification' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: data.actions || [
      { action: 'open', title: 'View' },
      { action: 'close', title: 'Dismiss' }
    ],
    tag: data.tag || 'prime-self-notification',
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if a window is already open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync event (for offline actions)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Retry failed API requests
      syncPendingRequests()
    );
  }
});

async function syncPendingRequests() {
  // Placeholder for future offline-first functionality
  // Could sync diary entries, chart saves, etc.
  console.log('[Service Worker] Syncing pending requests...');
}

// Periodic background sync (for transit updates)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-transits') {
    event.waitUntil(
      fetch('/api/transits/current')
        .then((response) => response.json())
        .then((data) => {
          // Update cache with fresh transit data
          return caches.open(CACHE_NAME).then((cache) => {
            return cache.put('/api/transits/current', new Response(JSON.stringify(data)));
          });
        })
        .catch((error) => {
          console.error('[Service Worker] Periodic sync failed:', error);
        })
    );
  }
});

console.log('[Service Worker] Loaded');
