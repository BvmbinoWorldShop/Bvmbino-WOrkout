const CACHE_NAME = 'bvmbino-offline-v6';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './hero_img.jpg',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=Barlow+Condensed:ital,wght@0,300;0,400;0,600;0,700;0,900;1,700&family=Barlow:wght@300;400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        CORE_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' })
            .then((res) => {
              if (res && (res.ok || res.type === 'opaque')) {
                return cache.put(url, res);
              }
            })
            .catch(() => cache.add(url).catch(() => {}))
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const req = event.request;
  const url = new URL(req.url);

  // For HTML navigation requests: try network first so updates appear immediately when online,
  // and fall back to cached index.html immediately when offline!
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, clone);
              cache.put('./', clone.clone());
              cache.put('./index.html', clone.clone());
            });
          }
          return networkRes;
        })
        .catch(() =>
          caches.match(req)
            .then((r) => r || caches.match('./index.html'))
            .then((r) => r || caches.match('./'))
        )
    );
    return;
  }

  // For all other assets (images, fonts, manifest): cache-first with background update
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});
