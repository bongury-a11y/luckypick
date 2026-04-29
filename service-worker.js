/* ══════════════════════════════════════════════════════
   PickStar — Service Worker
   Version : 2026-04-27 | PickStar
   Strategy: Cache-first for app shell, Network-first for API
   ══════════════════════════════════════════════════════

   [Phase 1.2] Date-based cache name.
   When you push an update, change CACHE_NAME to today's date.
   The activate event will automatically delete all old caches.
   ══════════════════════════════════════════════════════ */

var CACHE_NAME = 'pickstar-2026-04-27';

/* App shell files — cached on install, served offline */
var APP_SHELL = [
    './',
    './ny_lottery_generator.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

/* ── INSTALL: cache the app shell ── */
self.addEventListener('install', function(e) {
    console.log('[SW] Installing cache:', CACHE_NAME);
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            console.log('[SW] Caching app shell');
            return cache.addAll(APP_SHELL);
        }).then(function() {
            /* Skip waiting so the new SW activates immediately */
            return self.skipWaiting();
        })
    );
});

/* ── ACTIVATE: delete old caches ── */
self.addEventListener('activate', function(e) {
    console.log('[SW] Activating:', CACHE_NAME);
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys
                    .filter(function(key) {
                        /* Delete any pickstar cache that is NOT the current version */
                        return key !== CACHE_NAME && key.indexOf('pickstar') === 0;
                    })
                    .map(function(key) {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(function() {
            /* Take control of all open tabs immediately */
            return self.clients.claim();
        })
    );
});

/* ── FETCH: serve from cache, fall back to network ── */
self.addEventListener('fetch', function(e) {
    var url = e.request.url;

    /* Always go to network for API calls (data.ny.gov) — never cache live data */
    if (url.indexOf('data.ny.gov') !== -1) {
        e.respondWith(
            fetch(e.request).catch(function() {
                /* Offline and no cache for API — return empty JSON array */
                return new Response('[]', {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    /* Always go to network for Google Fonts (CDN) */
    if (url.indexOf('fonts.googleapis.com') !== -1 ||
        url.indexOf('fonts.gstatic.com') !== -1) {
        e.respondWith(fetch(e.request).catch(function() {
            return new Response('', { status: 503 });
        }));
        return;
    }

    /* App shell: Cache-first strategy */
    e.respondWith(
        caches.match(e.request).then(function(cached) {
            if (cached) {
                return cached;
            }
            /* Not in cache — fetch from network and cache the response */
            return fetch(e.request).then(function(response) {
                /* Only cache valid same-origin responses */
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                var responseToCache = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(e.request, responseToCache);
                });
                return response;
            }).catch(function() {
                /* Offline and not cached — nothing we can do */
                return new Response('Offline — please reload when connected.', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            });
        })
    );
});
