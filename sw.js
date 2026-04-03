// PLTS SmartHome - Service Worker v1
// Cache name - bump version to invalidate old caches
const CACHE_NAME = 'plts-smarthome-v1';

// Static assets to pre-cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './css/style.css',
  './js/utils.js',
  './js/auth.js',
  './js/api.js',
  './js/pwa.js',
  './js/app.js',
  './js/dashboard.js',
  './js/controls.js',
  './js/rules-editor.js',
  './js/admin.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Queue for failed API calls (background sync)
const API_QUEUE_NAME = 'api-sync-queue';

// ============================================================
// INSTALL EVENT - Pre-cache all static assets
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-cache failed for some assets:', err);
        // Don't fail install if CDN resources fail
        return caches.open(CACHE_NAME).then((cache) => {
          return cache.addAll(
            STATIC_ASSETS.filter(a => !a.startsWith('https://'))
          );
        }).then(() => self.skipWaiting());
      })
  );
});

// ============================================================
// ACTIVATE EVENT - Clean up old caches
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ============================================================
// LISTEN FOR SKIP_WAITING MESSAGE
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting received');
    self.skipWaiting();
  }
});

// ============================================================
// FETCH EVENT - Routing strategy
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    // Queue POST requests for background sync
    if (request.url.includes('macros/s/')) {
      event.respondWith(
        fetch(request)
          .catch(() => {
            // Queue the failed request for retry
            return queueApiCall(request);
          })
      );
    }
    return;
  }

  // API calls - Network first, fallback to cache
  if (url.hostname.includes('script.google.com') || url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // CDN resources - Cache first, fallback to network
  if (url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Static assets - Cache first strategy
  event.respondWith(cacheFirst(request));
});

// ============================================================
// STRATEGY: Cache First
// ============================================================
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // Offline fallback for HTML pages
    if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
      const cached = await caches.match('./dashboard.html');
      if (cached) return cached;
      const indexCached = await caches.match('./index.html');
      if (indexCached) return indexCached;
    }
    return new Response('Offline - Tidak ada koneksi internet', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// ============================================================
// STRATEGY: Network First
// ============================================================
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ success: false, error: 'Offline' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================
// BACKGROUND SYNC - Queue failed API calls
// ============================================================
async function queueApiCall(request) {
  try {
    const body = await request.clone().text();
    const queue = await openDB();
    await new Promise((resolve, reject) => {
      const tx = queue.transaction(API_QUEUE_NAME, 'readwrite');
      const store = tx.objectStore(API_QUEUE_NAME);
      store.add({
        url: request.url,
        method: request.method,
        body: body,
        headers: Object.fromEntries(request.headers.entries()),
        timestamp: Date.now()
      });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    // Notify clients about queued request
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'API_QUEUED',
          message: 'Permintaan ditambahkan ke antrian (offline)'
        });
      });
    });

    return new Response(JSON.stringify({ success: false, error: 'Offline - Antrian' }), {
      status: 202,
      statusText: 'Accepted',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Gagal menyimpan ke antrian' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================
// SYNC EVENT - Retry queued API calls when back online
// ============================================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'api-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(retryQueuedCalls());
  }
});

async function retryQueuedCalls() {
  try {
    const queue = await openDB();
    const tx = queue.transaction(API_QUEUE_NAME, 'readwrite');
    const store = tx.objectStore(API_QUEUE_NAME);
    const allItems = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });

    for (const item of allItems) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body
        });
        if (response.ok) {
          await new Promise((resolve, reject) => {
            const deleteTx = queue.transaction(API_QUEUE_NAME, 'readwrite');
            deleteTx.objectStore(API_QUEUE_NAME).delete(item.timestamp);
            deleteTx.oncomplete = resolve;
            deleteTx.onerror = reject;
          });
          console.log('[SW] Queued call succeeded:', item.url);
        }
      } catch (err) {
        console.warn('[SW] Queued call failed (will retry later):', item.url);
      }
    }

    // Notify clients
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          message: 'Sinkronisasi antrian selesai'
        });
      });
    });
  } catch (err) {
    console.error('[SW] Sync error:', err);
  }
}

// ============================================================
// IndexedDB helper for API queue
// ============================================================
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('plts-sw-queue', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(API_QUEUE_NAME)) {
        db.createObjectStore(API_QUEUE_NAME, { keyPath: 'timestamp' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// PUSH EVENT - Future notification support
// ============================================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = {
    title: 'PLTS SmartHome',
    body: 'Notifikasi baru',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    data: { url: './dashboard.html' }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: data.data,
      vibrate: [100, 50, 100],
      tag: 'plts-alert',
      renotify: true
    })
  );
});

// ============================================================
// NOTIFICATION CLICK EVENT
// ============================================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If dashboard is already open, focus it
        for (const client of clientList) {
          if (client.url.includes('dashboard.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data?.url || './dashboard.html');
        }
      })
  );
});
