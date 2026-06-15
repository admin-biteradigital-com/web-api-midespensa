const CACHE_NAME = "mi-despensa-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./indexeddb.js",
  "./sync.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Evitar interceptar llamadas a la API
  if (event.request.url.includes("/api/v1/")) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() => {
          // Fallback offline si el recurso no está en cache y falla la red
          return new Response("Contenido no disponible sin conexión", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        })
      );
    })
  );
});
