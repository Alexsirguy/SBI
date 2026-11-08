// Offline support for saved lessons (#116, ADR 0028); lesson data itself lives in IndexedDB.
const CACHE = "sbi-offline-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("sbi-offline-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Build files never change under their name, so a cached copy is always right.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

// Pages come from the network when it is there; offline, every page falls back to saved lessons.
async function page(request, url) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (url.pathname === OFFLINE && response.ok) await cache.put(OFFLINE, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(OFFLINE);
    if (saved) return saved;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only our own files: API calls and anything else go straight to the network, untouched.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg") {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(page(request, url));
  }
});
