"use strict";
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE_PREFIX = "fixmycity-shell-";
const CACHE_NAME = CACHE_PREFIX + "20261027-typescript-v1";
const BASE = sw.registration.scope;
const SHELL = [
  "index.html",
  "styles.css",
  "app.js",
  "intro.html",
  "intro.js",
  "city-map.js",
  "city-map.css",
  "photo-picker.js",
  "photo-picker.css",
  "story-gestures.js",
  "pwa.js",
  "manifest.webmanifest",
  "assets/brand-mark.svg",
  "assets/brand-wordmark.svg",
  "assets/brand-wordmark-compact.svg",
  "assets/city-map.svg",
  "assets/fonts/inter.woff2",
  "assets/fonts/inter-tight.woff2",
  "assets/issues/drain.webp",
  "assets/issues/kuala-lumpur.webp",
  "assets/issues/litter.webp",
  "assets/issues/pothole.webp",
  "assets/issues/streetlight.webp",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/vendor/maplibre-gl-6.12.0.css",
  "assets/vendor/maplibre-6.12.0/maplibre-gl.mjs",
  "assets/vendor/maplibre-6.12.0/maplibre-gl-shared.mjs",
  "assets/vendor/maplibre-6.12.0/maplibre-gl-worker.mjs",
].map((path) => new URL(path, BASE).href);
const STATIC_URLS = new Set(SHELL);
const INDEX_URL = new URL("index.html", BASE).href;

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))),
      ),
  );
  // Updates activate after the previous app windows close, preserving in-progress work.
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await sw.clients.claim();
    })(),
  );
});

async function networkFirst(
  request: Request,
  cacheKey: string,
): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.redirected) {
      try {
        await cache.put(cacheKey, response.clone());
      } catch {}
    }
    if (response.status >= 500) {
      const saved = await cache.match(cacheKey);
      if (saved) return saved;
    }
    return response;
  } catch (error) {
    const saved = await cache.match(cacheKey);
    if (saved) return saved;
    throw error;
  }
}

sw.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url),
    scope = new URL(BASE);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname))
    return;
  const normalized = url.origin + url.pathname;
  if (
    request.mode === "navigate" &&
    (url.pathname === scope.pathname || normalized === INDEX_URL)
  ) {
    event.respondWith(networkFirst(request, INDEX_URL));
  } else if (STATIC_URLS.has(normalized)) {
    event.respondWith(networkFirst(request, normalized));
  }
  // Map tiles, geocoding, API traffic and other origins stay outside this cache.
});
