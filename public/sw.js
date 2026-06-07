// ═══════════════════════════════════════════════════════════════════════════════
// Mnemosyne v1 — Service Worker
// Offline-first caching, background sync, and push notification support
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'mnemosyne-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const API_CACHE = `${CACHE_VERSION}-api`

// Cache durations (in seconds)
const API_CACHE_TTL = 60 // 1 minute for API responses
const STATIC_CACHE_TTL = 30 * 24 * 60 * 60 // 30 days for static assets

// Static assets to pre-cache on install
const PRE_CACHE_URLS = [
  '/',
  '/logo.svg',
  '/robots.txt',
]

// Routes that should use network-first strategy (API calls)
const API_ROUTES = ['/api/']

// File extensions for cache-first strategy (static assets)
const STATIC_EXTENSIONS = [
  '.js', '.css', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.webm', '.mp4', '.woff2',
]

// ─── Install Event ────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[Mnemosyne SW] Installing service worker v1...')

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Mnemosyne SW] Pre-caching static assets')
      return cache.addAll(PRE_CACHE_URLS).catch((err) => {
        console.warn('[Mnemosyne SW] Some pre-cache URLs failed:', err)
      })
    }).then(() => {
      // Force activate without waiting for existing clients to close
      return self.skipWaiting()
    })
  )
})

// ─── Activate Event ───────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[Mnemosyne SW] Activating service worker v1...')

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('mnemosyne-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[Mnemosyne SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim()
    })
  )
})

// ─── Fetch Event ──────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests for caching (except for background sync)
  if (request.method !== 'GET') {
    return
  }

  // Skip cross-origin requests (except for fonts and CDNs we trust)
  if (url.origin !== self.location.origin && !isCacheableCrossOrigin(url)) {
    return
  }

  // Strategy selection based on request type
  if (isApiRequest(url)) {
    // Network-first for API calls
    event.respondWith(networkFirst(request, API_CACHE))
  } else if (isStaticAsset(url)) {
    // Cache-first for static assets (JS, CSS, fonts, images)
    event.respondWith(cacheFirst(request, STATIC_CACHE))
  } else if (isHtmlRequest(request)) {
    // Stale-while-revalidate for HTML pages
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
  } else {
    // Default: stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
  }
})

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  console.log('[Mnemosyne SW] Background sync triggered:', event.tag)

  if (event.tag === 'mnemosyne-sync-notes') {
    event.waitUntil(syncOfflineNotes())
  }

  if (event.tag === 'mnemosyne-sync-data') {
    event.waitUntil(syncAllOfflineData())
  }
})

// ─── Push Notification ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  console.log('[Mnemosyne SW] Push notification received')

  let data = {
    title: 'Mnemosyne',
    body: 'You have a new update',
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: 'mnemosyne-notification',
    data: {},
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      data = { ...data, ...payload }
    } catch {
      data.body = event.data.text() || data.body
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      vibrate: [100, 50, 100],
      actions: [
        { action: 'open', title: 'Open Mnemosyne' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  )
})

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[Mnemosyne SW] Notification clicked:', event.action)
  event.notification.close()

  if (event.action === 'dismiss') return

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window
      return self.clients.openWindow('/')
    })
  )
})

// ─── Message Handler ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Mnemosyne SW] Skip waiting requested')
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const { urls } = event.data
    if (Array.isArray(urls)) {
      caches.open(STATIC_CACHE).then((cache) => {
        cache.addAll(urls).catch((err) => {
          console.warn('[Mnemosyne SW] Failed to cache URLs:', err)
        })
      })
    }
  }

  if (event.data && event.data.type === 'CLEAR_CACHES') {
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)))
    }).then(() => {
      console.log('[Mnemosyne SW] All caches cleared')
    })
  }

  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    getCacheSize().then((size) => {
      event.ports[0]?.postMessage({ type: 'CACHE_SIZE', size })
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// Caching Strategies
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cache-first: Try cache, fall back to network
 * Best for: Static assets that rarely change (JS, CSS, fonts, images)
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/')
      if (offlinePage) return offlinePage
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

/**
 * Network-first: Try network, fall back to cache
 * Best for: API calls where fresh data is preferred
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      // Clone before caching since response can only be consumed once
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(request)
    if (cached) {
      // Add warning header for stale data
      const headers = new Headers(cached.headers)
      headers.set('X-Mnemosyne-Cache', 'stale')
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      })
    }

    return new Response(
      JSON.stringify({ error: 'You are offline and no cached data is available' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * Stale-while-revalidate: Return cache immediately, update in background
 * Best for: HTML pages and non-critical resources
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  // Fetch in background to update cache
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => {
      // Network failed, but we may have cache
      return null
    })

  // Return cached version immediately if available
  if (cached) {
    // Revalidate in background (don't await)
    fetchPromise.catch(() => {})
    return cached
  }

  // No cache, wait for network
  const response = await fetchPromise
  if (response) {
    return response
  }

  // Complete offline fallback
  if (request.mode === 'navigate') {
    const offlinePage = await caches.match('/')
    if (offlinePage) return offlinePage
  }

  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function isApiRequest(url) {
  return API_ROUTES.some((route) => url.pathname.startsWith(route))
}

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))
}

function isHtmlRequest(request) {
  return (
    request.mode === 'navigate' ||
    request.headers.get('Accept')?.includes('text/html') ||
    new URL(request.url).pathname.endsWith('.html') ||
    new URL(request.url).pathname === '/'
  )
}

function isCacheableCrossOrigin(url) {
  // Allow caching fonts from common CDNs
  const cacheableHosts = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
  ]
  return cacheableHosts.some((host) => url.hostname.includes(host))
}

// ─── Offline Data Sync ────────────────────────────────────────────────────────

async function syncOfflineNotes() {
  try {
    const db = await openOfflineDB()
    const tx = db.transaction('offline-notes', 'readonly')
    const store = tx.objectStore('offline-notes')
    const notes = await store.getAll()

    for (const note of notes) {
      try {
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note),
        })

        if (response.ok) {
          // Remove from offline store after successful sync
          const deleteTx = db.transaction('offline-notes', 'readwrite')
          const deleteStore = deleteTx.objectStore('offline-notes')
          await deleteStore.delete(note.id)
        }
      } catch (err) {
        console.warn('[Mnemosyne SW] Failed to sync note:', note.id, err)
      }
    }
  } catch (err) {
    console.warn('[Mnemosyne SW] Failed to open offline DB for sync:', err)
  }
}

async function syncAllOfflineData() {
  await syncOfflineNotes()
  // Add more sync operations here as needed
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mnemosyne-offline', 1)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('offline-notes')) {
        db.createObjectStore('offline-notes', { keyPath: 'id' })
      }
    }

    request.onsuccess = (event) => {
      resolve(event.target.result)
    }

    request.onerror = (event) => {
      reject(event.target.error)
    }
  })
}

// ─── Cache Management ─────────────────────────────────────────────────────────

async function getCacheSize() {
  let totalSize = 0
  const cacheNames = await caches.keys()

  for (const name of cacheNames) {
    const cache = await caches.open(name)
    const requests = await cache.keys()
    totalSize += requests.length
  }

  return totalSize
}
