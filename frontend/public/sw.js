// Service Worker without caching - Completely disabled caching
// This enables PWA functionality without storing any files

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  // Delete all existing caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  
  event.waitUntil(
    Promise.all([
      // Clear all caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch from network, no caching whatsoever
  // Also prevent any caching headers from being respected
  event.respondWith(
    fetch(event.request, {
      cache: 'no-store',
      headers: {
        ...event.request.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  );
});

// Prevent any background sync or other caching mechanisms
self.addEventListener('sync', (event) => {
  event.waitUntil(Promise.resolve());
});

self.addEventListener('push', (event) => {
  event.waitUntil(Promise.resolve());
});