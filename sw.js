// ═══════════════════════════════════════════════════
//  Course d'Orientation — Service Worker
//  Cache-first strategy + offline fallback
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'orientation-v1';

// Fichiers du shell applicatif mis en cache à l'installation
const SHELL_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Ressources CDN mises en cache à la volée
const CDN_DOMAINS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ── INSTALL : pré-cache du shell ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pré-cache du shell applicatif');
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE : nettoyage des anciens caches ───────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH : stratégie cache-first ─────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore les requêtes non-GET (API, POST, etc.)
  if (request.method !== 'GET') return;

  // Ignore les extensions Chrome et les requêtes internes
  if (url.protocol === 'chrome-extension:') return;

  // CDN : cache-first avec mise en cache à la volée
  const isCDN = CDN_DOMAINS.some(d => url.hostname.includes(d));

  if (isCDN) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (!response || response.status !== 200) return response;
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
          return response;
        }).catch(() => {
          // Ressource CDN indisponible hors-ligne — rien à retourner
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // Ressources locales : cache-first, réseau en fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Mise à jour en arrière-plan (stale-while-revalidate)
        const fetchPromise = fetch(request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          }
          return response;
        }).catch(() => {});
        return cached;
      }

      // Pas dans le cache : on va chercher sur le réseau
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
        return response;
      }).catch(() => {
        // Hors-ligne et pas en cache : renvoyer index.html (SPA fallback)
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
        return new Response('Contenu indisponible hors-ligne.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});

// ── MESSAGE : forcer la mise à jour ──────────────
self.addEventListener('message', event => {
  if (event.data?.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
