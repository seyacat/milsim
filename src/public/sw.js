// Service Worker for Milsim PWA
const CACHE_NAME = 'milsim-v1.0.0';
const urlsToCache = [
  '/',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/owner.html',
  '/player.html',
  '/create-game.html',
  '/styles.css',
  '/manifest.json',
  '/js/game-core.js',
  '/js/game-owner.js',
  '/js/game-player.js',
  '/js/control-points-owner.js',
  '/js/control-points-player.js',
  '/js/pwa-install.js'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Use Promise.all to handle individual cache failures gracefully
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(error => {
              console.warn(`Failed to cache ${url}:`, error);
              // Continue even if individual files fail
              return Promise.resolve();
            });
          })
        );
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET' || 
      event.request.url.includes('/api/') ||
      event.request.url.includes('/socket.io/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            // For navigation requests, return the cached page
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // This would handle syncing any pending actions when back online
  // Implementation would depend on specific offline actions needed
}

// Handle push notifications
self.addEventListener('push', event => {
  
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación de Milsim',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiMyZDVhMmQiLz4KPHBhdGggZD0iTTk2IDQ4QzY5LjQ5IDQ4IDQ4IDY5LjQ5IDQ4IDk2QzQ4IDEyMi41MSA2OS40OSAxNDQgOTYgMTQ0QzEyMi41MSAxNDQgMTQ0IDEyMi41MSAxNDQgOTZDMTQ0IDY5LjQ5IDEyMi41MSA0OCA5NiA0OFoiIGZpbGw9IiNlOGY1ZTgiLz4KPC9zdmc+Cg==',
    badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzIiIGhlaWdodD0iNzIiIHZpZXdCb3g9IjAgMCA3MiA3MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiByeD0iOCIgZmlsbD0iIzJkNWEyZCIvPgo8L3N2Zz4K',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'milsim-notification'
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir App'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Milsim', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({type: 'window'}).then(windowClients => {
        for (let client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});