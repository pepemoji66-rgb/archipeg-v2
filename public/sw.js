// Service Worker con estrategia Network First para HTML
const CACHE_NAME = 'archipeg-pwa-v2'; // Cambiado a v2 para forzar actualización
const urlsToCache = [
  '/',
  '/index.html',
  '/logo_archipeg_principal.png'
];

// Instalar el Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  // Fuerza al SW a activarse inmediatamente
  self.skipWaiting();
});

// Estrategia de Fetch: Network First, fallback to Cache
self.addEventListener('fetch', event => {
  // Ignorar peticiones a la API
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la red responde bien, clonamos la respuesta y la actualizamos en caché
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Si no hay red (offline), buscamos en la caché
        return caches.match(event.request);
      })
  );
});

// Activar el Service Worker y limpiar cachés antiguos
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Tomar control de los clientes inmediatamente
      return self.clients.claim();
    })
  );
});
