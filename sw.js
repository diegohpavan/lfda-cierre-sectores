// Service worker de LFDA · Cierre Diario por Sector
//
// Estrategia: "red primero, caché como respaldo". El index.html NUNCA se cachea
// para garantizar que cualquier actualización llegue inmediatamente.
// Los íconos y manifest sí se cachean (cambian rarísimo).
const CACHE_NAME = 'lfda-cierre-v2';
const ARCHIVOS_ESTATICOS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_ESTATICOS))
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
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // index.html: siempre desde la red, sin caché — así cada update llega al instante
  const esIndex = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (esIndex) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match('./index.html')
      )
    );
    return;
  }

  // resto (íconos, manifest): red primero, caché como respaldo
  event.respondWith(
    fetch(event.request)
      .then((respuestaRed) => {
        const copia = respuestaRed.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respuestaRed;
      })
      .catch(() =>
        caches.match(event.request).then((respuestaCache) => {
          if (respuestaCache) return respuestaCache;
          return new Response('Sin conexión y sin versión guardada en este dispositivo.', {
            status: 503,
            statusText: 'Offline'
          });
        })
      )
  );
});
