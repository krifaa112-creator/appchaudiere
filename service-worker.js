const CACHE_NAME = "pieces-chaudieres-v63";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=63",
  "./app.js?v=63",
  "./saunier-duval-models.js?v=57",
  "./piecesxpress-duomax-condens-f30-90-1-parts.js",
  "./elmleblanc-tirage-naturel-models.js?v=63",
  "./elmleblanc-tirage-naturel-parts-by-model.js?v=63",
  "./elmleblanc-tirage-naturel-exploded-views.js?v=63",
  "./elmleblanc-ventouse-models.js?v=63",
  "./elmleblanc-ventouse-parts-by-model.js?v=63",
  "./elmleblanc-ventouse-exploded-views.js?v=63",
  "./elmleblanc-vmc-models.js?v=63",
  "./elmleblanc-vmc-parts-by-model.js?v=63",
  "./elmleblanc-vmc-exploded-views.js?v=63",
  "./elmleblanc-bas-nox-tirage-naturel-models.js?v=63",
  "./elmleblanc-bas-nox-tirage-naturel-parts-by-model.js?v=63",
  "./elmleblanc-bas-nox-tirage-naturel-exploded-views.js?v=63",
  "./elmleblanc-bas-nox-vmc-models.js?v=63",
  "./elmleblanc-bas-nox-vmc-parts-by-model.js?v=63",
  "./elmleblanc-bas-nox-vmc-exploded-views.js?v=63",
  "./elmleblanc-condensation-models.js?v=63",
  "./elmleblanc-condensation-parts-by-model.js?v=63",
  "./elmleblanc-condensation-exploded-views.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-condensation-models.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-condensation-parts-by-model.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-condensation-exploded-views.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-bas-nox-vmc-models.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-bas-nox-vmc-parts-by-model.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-bas-nox-vmc-exploded-views.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-bas-nox-ventouse-models.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-bas-nox-ventouse-parts-by-model.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-bas-nox-ventouse-exploded-views.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-bas-nox-tirage-naturel-models.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-bas-nox-tirage-naturel-parts-by-model.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-bas-nox-tirage-naturel-exploded-views.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-basse-temperature-vmc-models.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-basse-temperature-vmc-parts-by-model.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-basse-temperature-vmc-exploded-views.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-basse-temperature-ventouse-models.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-basse-temperature-ventouse-parts-by-model.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-basse-temperature-ventouse-exploded-views.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-basse-temperature-tirage-naturel-models.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-basse-temperature-tirage-naturel-parts-by-model.js?v=63",
  "./elmleblanc-ecs-chauffe-bain-basse-temperature-tirage-naturel-exploded-views.js?v=63",
  "./elmleblanc-gaz-chaudiere-sol-condensation-models.js?v=63",
  "./elmleblanc-gaz-chaudiere-sol-condensation-parts-by-model.js?v=63",
  "./elmleblanc-gaz-chaudiere-sol-condensation-exploded-views.js?v=63",
  "./elmleblanc-gaz-chaudiere-sol-basse-temperature-tirage-naturel-models.js?v=63",
  "./elmleblanc-gaz-chaudiere-sol-basse-temperature-tirage-naturel-parts-by-model.js?v=63",
  "./elmleblanc-gaz-chaudiere-sol-basse-temperature-tirage-naturel-exploded-views.js?v=63",
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
    url.pathname.endsWith("/elmleblanc-ventouse-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-ventouse-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-vmc-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-vmc-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-bas-nox-tirage-naturel-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-bas-nox-tirage-naturel-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-bas-nox-vmc-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-bas-nox-vmc-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-condensation-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-condensation-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-condensation-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-condensation-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-bas-nox-vmc-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-bas-nox-vmc-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-bas-nox-ventouse-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-bas-nox-ventouse-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-bas-nox-tirage-naturel-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-bas-nox-tirage-naturel-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-basse-temperature-vmc-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-basse-temperature-vmc-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-basse-temperature-ventouse-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-basse-temperature-ventouse-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-basse-temperature-tirage-naturel-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-ecs-chauffe-bain-basse-temperature-tirage-naturel-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-gaz-chaudiere-sol-condensation-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-gaz-chaudiere-sol-condensation-exploded-views.js") ||
    url.pathname.endsWith("/elmleblanc-gaz-chaudiere-sol-basse-temperature-tirage-naturel-parts-by-model.js") ||
    url.pathname.endsWith("/elmleblanc-gaz-chaudiere-sol-basse-temperature-tirage-naturel-exploded-views.js") ||
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



