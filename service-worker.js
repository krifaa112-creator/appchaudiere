const CACHE_NAME = "pieces-chaudieres-v58";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=58",
  "./app.js?v=58",
  "./saunier-duval-models.js?v=57",
  "./piecesxpress-duomax-condens-f30-90-1-parts.js",
  "./elmleblanc-tirage-naturel-models.js?v=58",
  "./elmleblanc-tirage-naturel-parts-by-model.js?v=58",
  "./elmleblanc-tirage-naturel-exploded-views.js?v=58",
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
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (
    url.pathname.endsWith("/saunier-duval-parts-by-model.js") ||
    url.pathname.endsWith("/saunier-duval-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-tirage-naturel-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-tirage-naturel-exploded-views.js") ||
    url.pathname.includes("/assets/sparecheck-documents/")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
