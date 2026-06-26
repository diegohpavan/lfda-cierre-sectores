// Service worker de LFDA · Cierre Diario por Sector
//
// Estrategia: "red primero, caché como respaldo". Esta app se actualiza seguido
// (cada corrección se sube reemplazando index.html), así que NO conviene cachear
// agresivamente — eso dejaría a los líderes atascados en una versión vieja.
// El caché solo se usa si el dispositivo está sin conexión.

const CACHE_NAME = 'lfda-cierre-v1';
const ARCHIVOS_BASICOS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_BASICOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo manejamos peticiones GET de nuestro propio origen — todo lo demás
  // (Firebase, CDNs de Chart.js/jsPDF, etc.) pasa directo a la red sin interceptar.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((respuestaRed) => {
        // si la red contesta bien, actualizamos el caché con la versión nueva
        const copia = respuestaRed.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respuestaRed;
      })
      .catch(() => {
        // sin conexión: usamos lo que haya en caché como respaldo
        return caches.match(event.request).then((respuestaCache) => {
          if (respuestaCache) return respuestaCache;
          // si ni siquiera está en caché, no hay nada más que ofrecer
          return new Response('Sin conexión y sin versión guardada en este dispositivo.', {
            status: 503,
            statusText: 'Offline'
          });
        });
      })
  );
});
