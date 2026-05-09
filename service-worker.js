const CACHE_NAME = "pieces-chaudieres-v40";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=40",
  "./app.js?v=40",
  "./saunier-duval-models.js?v=40",
  "./saunier-duval-parts-by-model.js?v=40",
  "./piecesxpress-duomax-condens-f30-90-1-parts.js",
  "./saunier-duval-exploded-views.js?v=40",
  "./manifest.webmanifest",
  "./assets/boiler-room-bg.png",
  "./assets/logo-egs.png",
  "./assets/logo-egs-transparent.png",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
