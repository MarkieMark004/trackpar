const CACHE_NAME = "trackpar-v1";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/course-play.html",
  "/scorecard.html",
  "/saved-score.html",
  "/saved-score-view.html",
  "/resume-active-card.html",
  "/save-course-details.html",
  "/styles/styles.css",
  "/script/script.js",
  "/script/manual-courses.js",
  "/img/logo.png",
  "/img/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return response;
      });
    })
  );
});
