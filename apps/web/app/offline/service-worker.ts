const CACHE = "sbi-offline-v1";

// Registered only once a learner saves a lesson or opens saved lessons, so other pages stay as they are.
export async function enableOffline(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  await warmCache();
}

/** Caches the saved-lessons page and every build file this page has loaded, visuals included. */
async function warmCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(CACHE);
  const files = new Set(
    performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name))
      .filter((url) => url.origin === location.origin && url.pathname.startsWith("/_next/static/"))
      .map((url) => url.pathname + url.search),
  );
  try {
    const response = await fetch("/offline", { credentials: "same-origin" });
    if (response.ok) {
      const html = await response.clone().text();
      await cache.put("/offline", response);
      for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) {
        if (match[1]) files.add(match[1].replace(/&amp;/g, "&"));
      }
    }
  } catch {
    // Offline already: whatever was cached before is what there is.
  }
  await Promise.all(
    [...files].map(async (file) => {
      if (!(await cache.match(file))) await cache.add(file).catch(() => undefined);
    }),
  );
}
