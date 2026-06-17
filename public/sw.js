// Service Worker básico para PWA
const CACHE_NAME = 'archipeg-pwa-v1';
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
});

// Cache y Network fallback
self.addEventListener('fetch', event => {
  // Ignorar peticiones a la API para no cachear datos dinámicos
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve el recurso cacheado si existe
        if (response) {
          return response;
        }
        // Si no está en caché, lo pide a la red
        return fetch(event.request);
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
    })
  );
});
