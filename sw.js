/* MoneyTrack PWA service worker — app-shell offline, API always network. */
var CACHE = 'moneytrack-pwa-v6';
var SHELL = ['.', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // no-cache: never seed the shell from a stale HTTP-cache entry.
    return Promise.all(SHELL.map(function (u) {
      return fetch(u, { cache: 'no-cache' }).then(function (r) { return c.put(u, r); });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // never cache API POST / mutations
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // GAS API & Drive: pass through

  // Navigations: ALWAYS revalidate with the network (bypass the HTTP cache,
  // which on GitHub Pages is fresh for 10 min), fall back to shell only offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put('index.html', copy); c.put('.', copy.clone()); });
      return res;
    }).catch(function () { return caches.match('index.html'); }));
    return;
  }

  // Static same-origin assets: cache first, then network.
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    });
  }));
});
